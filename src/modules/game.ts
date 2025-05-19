import { db } from "db";
import {
  battleFields,
  checkHit,
  createMessage,
  logMessage,
} from "misc/helpers";
import { AttackData, ShotStatus } from "types";

export const gameModule = {
  turn(gameId: string, currentPlayer?: string, switchTurn = true) {
    const turnInfo = { currentPlayer: "" };
    const game = db.runningGames.get(gameId);

    if (!game) return;

    const players = Object.keys(game);

    if (!currentPlayer) {
      turnInfo.currentPlayer = players[0];
    } else if (!switchTurn) {
      turnInfo.currentPlayer = currentPlayer;
    } else {
      turnInfo.currentPlayer = players.find(
        (player) => player !== currentPlayer
      )!;
    }

    db.currentTurns.set(gameId, turnInfo.currentPlayer);

    players.forEach((player) => {
      game[player].socket.send(createMessage({ type: "turn", data: turnInfo }));
    });

    logMessage({ type: "turn", data: turnInfo });
  },

  attack(data: AttackData): ShotStatus | "endGame" | false {
    const { x, y, indexPlayer, gameId } = data;

    const currentPlayer = db.currentTurns.get(gameId);

    if (currentPlayer !== indexPlayer) return false;

    const coordinates = db.shipCoordinates.get(gameId);

    if (!coordinates)
      throw new Error(`Coordinates for game ${gameId} not found!`);

    const game = db.runningGames.get(gameId);

    if (!game) return false;

    const players = Object.keys(game);

    const attackedPlayer = players.find((player) => player !== indexPlayer)!;

    const playerStats = coordinates[attackedPlayer];

    const { result, surrounding, hits } = checkHit({
      x,
      y,
      ships: playerStats.ships,
      currentPlayer: indexPlayer,
    });

    if (result.status === "killed") playerStats.killCount += 1;

    const isWinner = playerStats.killCount === 10;
    console.log(playerStats.killCount);
    players.forEach((player) => {
      const socket = game[player].socket;

      socket.send(createMessage({ type: "attack", data: result }));

      if (result.status !== "killed") return;

      if (!surrounding) return;

      surrounding.forEach((coord) => {
        socket.send(
          createMessage({
            type: "attack",
            data: { position: coord, currentPlayer, status: "miss" },
          })
        );
      });

      if (!hits || hits?.length < 2) return;

      hits.forEach((hitCoord) => {
        socket.send(
          createMessage({
            type: "attack",
            data: { position: hitCoord, currentPlayer, status: "killed" },
          })
        );
      });
    });

    logMessage({ type: "attack", data: result });

    if (isWinner) {
      players.forEach((player) => {
        const socket = game[player].socket;

        socket.send(
          createMessage({ type: "finish", data: { winPlayer: indexPlayer } })
        );
      });

      logMessage({ type: "finish", data: { winPlayer: indexPlayer } });

      const username = db.userUuids.get(currentPlayer)!;
      const winner = db.winners?.find((user) => user.name === username);

      if (winner) winner.wins += 1;
      const sortedWinners = [...db.winners].sort((a, b) => b.wins - a.wins);

      db.usersWs.forEach((socket) =>
        socket.send(
          createMessage({
            type: "update_winners",
            data: sortedWinners,
          })
        )
      );

      logMessage({ type: "update_winners", data: { sortedWinners } });

      return "endGame";
    }

    return result.status;
  },

  randomAttack(
    gameId: string,
    indexPlayer: string
  ): ShotStatus | "endGame" | false {
    const fields = [...battleFields];

    const ships = db.shipCoordinates.get(gameId)?.[indexPlayer].ships;

    if (!ships) return false;

    const nonAttackedFields = fields.filter((coords) =>
      ships.some(({ x, y }) => !x.includes(coords.x) && !y.includes(coords.y))
    );

    const { x, y } =
      nonAttackedFields[Math.floor(Math.random() * nonAttackedFields.length)];

    const attackData = { x, y, gameId, indexPlayer };

    logMessage({ type: "randomAttack", data: attackData });

    const attackResult = this.attack(attackData);

    return attackResult;
  },
};
