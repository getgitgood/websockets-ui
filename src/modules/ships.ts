import { db } from "db";
import { createMessage, getShipCoords, logMessage } from "misc/helpers";
import { AddShipsEventData, ShipCoordinates, SocketWithUser } from "types";

export const shipsModule = {
  addShips({
    gameId,
    indexPlayer,
    ships,
    socket,
  }: AddShipsEventData & { socket: SocketWithUser }) {
    const game = db.runningGames.get(gameId);

    if (!game) {
      db.runningGames.set(gameId, { [indexPlayer]: { ships, socket } });

      return;
    }

    const state = { ...game, [indexPlayer]: { ships, socket } };
    db.runningGames.set(gameId, state);
    const shipCoords = Object.entries(state).reduce(
      (acc, [key, value]) => ({
        ...acc,
        [key]: { ships: getShipCoords(value.ships), killCount: 0 },
      }),
      {} as { [key: string]: { ships: ShipCoordinates[]; killCount: number } }
    );

    db.shipCoordinates.set(gameId, shipCoords);
  },

  startGame(gameId: string) {
    const players = db.runningGames.get(gameId);

    if (!players || Object.keys(players).length !== 2) return;

    Object.entries(players).forEach(
      ([currentPlayerIndex, { socket, ships }]) => {
        socket.send(
          createMessage({
            type: "start_game",
            data: { ships, currentPlayerIndex },
          })
        );

        logMessage({
          type: "start_game",
          data: { gameId, ships, currentPlayerIndex },
        });
      }
    );

    return true;
  },
};
