import { createHash } from "crypto";
import WebSocket from "ws";
import {
  RegEventCredentials,
  RegEventResponse,
  EventType,
  UserEntity,
  WinnerEntity,
  RoomEntity,
  ShipsData,
} from "types";

const createGameMessage = (
  type: EventType,
  data: unknown,
  ws: SocketWithUser
) => ({
  message: JSON.stringify({
    type,
    data: JSON.stringify(data),
    id: 0,
  }),
  ws,
});

type GameMessage = ReturnType<typeof createGameMessage>;

type SocketWithUser = WebSocket & { user: UserEntity };
export type DbEntity = {
  storage: {
    users: UserEntity[];
    rooms: RoomEntity[];
    winners: WinnerEntity[];
    usersWs: Map<string, SocketWithUser>;
    runningGames: Map<string, { [key: string]: ShipsData }>;
    hashNamePairs: Map<string, string>;
  };

  addPlayer: (
    data: RegEventCredentials,
    socket: SocketWithUser
  ) => UserEntity & { error: boolean; errorText: string };
  addUserToRoom: (roomId: string, username: string) => void;
  createGame: (roomId: string) => GameMessage[] | undefined;
  updateWinners: (winner: WinnerEntity) => string;
  addShips: (roomId: string, userId: string, ships: ShipsData) => boolean;
  startGame: (roomId: string) => GameMessage[] | undefined;
  createRoom: (userId: Required<UserEntity>) => void;
  roomsList: string;
  getUsersWs: () => Map<string, SocketWithUser>;
  getWsByUserId: (userId: string) => SocketWithUser | undefined;
  getCurrentTurn: (
    gameId: string,
    userHash?: string
  ) => GameMessage[] | undefined;
  getCurrentGameSockets: (gameId: string) => SocketWithUser[] | undefined;
};

export const db: DbEntity = {
  storage: {
    users: [],
    rooms: [],
    winners: [],
    usersWs: new Map(),
    runningGames: new Map(),
    hashNamePairs: new Map(),
  },

  addPlayer(data: RegEventCredentials, socket: SocketWithUser) {
    const users = this.storage.users;

    const { name } = data as RegEventCredentials;

    const userIsExisting = users.some((user) => user.name === name);

    if (userIsExisting) {
      return {
        ...data,
        error: true,
        errorText: `User with name ${name} already exists!`,
      };
    }

    const index = users.length;
    users.push({ ...data, index } as UserEntity);

    this.storage.usersWs.set(name, socket);
    return {
      ...data,
      error: false,
      errorText: "",
      index,
    };
  },

  updateWinners(winner: WinnerEntity) {
    const winners = this.storage.winners;
    const user = winners.find((user) => user.name === winner.name);
    const type = "update_winners" as keyof EventType;

    if (!user) winners.push(winner);
    else {
      const index = winners.indexOf(user);

      winners[index].wins = winner.wins;
    }

    return JSON.stringify({
      type,
      data: JSON.stringify(winners),
      id: 0,
    });
  },

  createRoom(user: Required<UserEntity>) {
    const { name, index } = user;
    const roomId = `${name}-room`;
    const rooms = this.storage.rooms;
    if (rooms.some((room) => room.roomId === roomId))
      throw new Error(`Room with a same id "${roomId}" already exists!`);

    this.storage.rooms.push({
      roomId,
      roomUsers: [{ name, index }],
    });
  },

  addUserToRoom(roomId, username) {
    const room = this.storage.rooms.find((room) => room.roomId === roomId);

    if (!room) throw new Error(`Room with id "${roomId}" not found!`);

    const user = this.storage.users.find((user) => user.name === username);

    if (user?.index === undefined) {
      console.warn(`User with name "${username}" not found!`);

      return;
    }

    room.roomUsers.push({ name: user.name, index: user.index });
  },

  createGame(roomId) {
    const room = this.storage.rooms.find((room) => room.roomId === roomId);

    if (!room) throw new Error(`Room with id ${roomId} not found!`);

    const { roomUsers } = room;
    const usernames = roomUsers.map(({ name }) => name);
    const [ws1, ws2] = Array.from(this.storage.usersWs)
      .filter(([id]) => usernames.includes(id))
      .map(([_, ws]) => ws);

    if (usernames.length !== 2)
      throw new Error("User data for one of the players missing");

    const [username1, username2] = usernames;
    const idGame = `${roomId}-session`;
    const hash1 = createHash("sha256")
      .update(username1)
      .digest("hex")
      .slice(0, 16);
    const hash2 = createHash("sha256")
      .update(username2)
      .digest("hex")
      .slice(0, 16);

    this.storage.hashNamePairs.set(hash1, username1);
    this.storage.hashNamePairs.set(hash2, username2);

    return [
      createGameMessage("create_game", { idGame, idPlayer: hash1 }, ws1),
      createGameMessage("create_game", { idGame, idPlayer: hash2 }, ws2),
    ];
  },

  getUsersWs() {
    return this.storage.usersWs;
  },

  getWsByUserId(userId?: string) {
    if (!userId) return;

    const wsArray = this.storage.usersWs;

    const ws = wsArray.get(userId);

    if (ws) return ws;

    throw new Error(`WebSocket for username ${userId} not found!`);
  },

  addShips(roomId, userId, ships) {
    const game = this.storage.runningGames.get(roomId);
    if (!game) {
      this.storage.runningGames.set(roomId, { [userId]: ships });

      return false;
    }

    const updatedState = { ...game, [userId]: ships };
    this.storage.runningGames.set(roomId, updatedState);

    return true;
  },

  startGame(roomId) {
    const game = this.storage.runningGames.get(roomId);
    const hashPairs = this.storage.hashNamePairs;

    if (!game) throw new Error(`Active game with id ${roomId} not found!`);

    const gameEntries = Object.keys(game);

    if (gameEntries.length !== 2)
      throw new Error(
        `Expected to get 2 users, got ${gameEntries.length} instead!`
      );

    const [hash1, hash2] = gameEntries;

    const [shipsData1, shipsData2] = [game[hash1], game[hash2]];

    const [username1, username2] = [hashPairs.get(hash1), hashPairs.get(hash2)];

    if (!username1 || !username2)
      throw new Error(
        `Expected to get usernames by hash, got undefined instead!`
      );

    const sockets = this.getCurrentGameSockets(roomId);
    if (!sockets) throw new Error("No sockets");

    const [ws1, ws2] = sockets;

    return [
      createGameMessage(
        "start_game",
        { ships: shipsData1, currentPlayerIndex: hash1 },
        ws1
      ),
      createGameMessage(
        "start_game",
        { ships: shipsData2, currentPlayerIndex: hash2 },
        ws2
      ),
    ];
  },
  getCurrentGameSockets(gameId) {
    const game = this.storage.runningGames.get(gameId);

    const hashPairs = this.storage.hashNamePairs;
    if (!game) throw new Error(`Game room with id ${gameId} not found!`);

    const [hash1, hash2] = Object.keys(game);

    const [username1, username2] = [hashPairs.get(hash1), hashPairs.get(hash2)];

    if (!username1 || !username2)
      throw new Error(
        `Expected to get usernames by hash, got undefined instead!`
      );
    const sockets = this.storage.usersWs;

    const [ws1, ws2] = [sockets.get(username1), sockets.get(username2)];

    if (!ws1 || !ws2)
      throw new Error(`Missing socket for one or both of the players!`);

    return [ws1, ws2];
  },
  getCurrentTurn(gameId, userHash) {
    const game = this.storage.runningGames.get(gameId);

    if (!game) throw new Error(`Game room with id ${gameId} not found!`);

    const [hash1, hash2] = Object.keys(game);

    const sockets = this.getCurrentGameSockets(gameId);

    if (!sockets)
      throw new Error(`Missing socket for one or both of the players!`);

    const [ws1, ws2] = sockets;

    let currentPlayer = hash1;

    if (userHash)
      currentPlayer = Object.keys(game).filter(
        (value) => value !== userHash
      )[0];

    console.log(`current turn is on ${currentPlayer}`);

    return [
      createGameMessage("turn", { currentPlayer }, ws1),
      createGameMessage("turn", { currentPlayer }, ws2),
    ];
  },
  get roomsList() {
    return JSON.stringify({
      type: "update_room",
      data: JSON.stringify(
        this.storage.rooms.filter(({ roomUsers }) => roomUsers.length === 1)
      ),
      index: 0,
    });
  },
};
