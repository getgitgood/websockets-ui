import {
  UserEntity,
  WinnerEntity,
  RoomEntity,
  ShipsData,
  ShipCoordinates,
  SocketWithUser,
} from "types";

export type DbEntity = {
  users: UserEntity[];
  rooms: RoomEntity[];
  winners: WinnerEntity[];
  usersWs: Map<string, SocketWithUser>;
  runningGames: Map<
    string,
    { [key: string]: { ships: ShipsData[]; socket: SocketWithUser } }
  >;
  userUuids: Map<string, string>;
  shipCoordinates: Map<
    string,
    { [key: string]: { ships: ShipCoordinates[]; killCount: number } }
  >;
  currentTurns: Map<string, string>;
};

export const db: DbEntity = {
  users: [],
  rooms: [],
  winners: [],
  usersWs: new Map(),
  runningGames: new Map(),
  userUuids: new Map(),
  shipCoordinates: new Map(),
  currentTurns: new Map(),
};
