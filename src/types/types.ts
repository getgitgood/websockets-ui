import WebSocket from "ws";

export type EventType =
  | "reg"
  | "update_winners"
  | "create_room"
  | "create_game"
  | "add_user_to_room"
  | "create_game"
  | "update_room"
  | "add_ships"
  | "start_game"
  | "turn"
  | "attack"
  | "randomAttack"
  | "finish";

export type RawEvent = {
  type: EventType;
  data: string;
  id: 0;
};

export type EventEntity<T extends EventType, Y> = {
  type: T;
  data: Y;
  id: 0;
};

export type RegEventCredentials = {
  name: string;
  password: string;
};

export type RegEventResponse = EventEntity<
  "reg",
  RegEventCredentials & { error: boolean; errorText: string }
>;

export type RegEvent = Omit<RegEventResponse, "data"> & {
  data: RegEventCredentials;
};

export type UserEntity = RegEventCredentials & { index?: number };

// ----------------------------------

export type RoomEntity = {
  roomId: number | string;
  roomUsers: { name: string; index: number | string }[];
};

export type IndexRoom = { indexRoom: string };

export type AddUserToRoomEvent = EventEntity<"add_user_to_room", IndexRoom>;

export type WinnerEntity = {
  name: string;
  wins: number;
};

// ----------------------------------
export type AddShipsEvent = {
  data: {
    gameId: string;
    ships: ShipsData;
    indexPlayer: string;
  };
  id: 0;
};

export type AddShipsEventData = {
  gameId: string;
  ships: ShipsData[];
  indexPlayer: string;
};

export type ShipsData = {
  position: Coords;
  direction: boolean;
  type: "small" | "medium" | "large" | "huge";
  length: number;
};

export type Coords = {
  x: number;
  y: number;
};

export type ShipCoordinates = Omit<ShipsData, "position"> & {
  x: number[];
  y: number[];
  surrounding?: Coords[];
  hits: Coords[];
};

export type ShotStatus = "shot" | "miss" | "killed";

export type AttackResult = {
  position: Coords;
  currentPlayer: string;
  status: ShotStatus;
};

export type SocketWithUser = WebSocket & { user: UserEntity };

export type UsersWs = Map<string, SocketWithUser>;

export interface DbStorage {
  users: UserEntity[];
  rooms: RoomEntity[];
  winners: WinnerEntity[];
  usersWs: Map<string, SocketWithUser>;
  runningGames: Map<string, { [key: string]: ShipsData[] }>;
  hashNamePairs: Map<string, string>;
  shipCoordinates: Map<string, { [key: string]: ShipCoordinates[] }>;
}

export type UserEntityError = UserEntity & {
  error: boolean;
  errorText: string;
};

export type AttackData = {
  gameId: string;
  indexPlayer: string;
} & Coords;

export const parseWsEvent = <T>(data: WebSocket.Data): T | null => {
  try {
    const outerData = JSON.parse(data.toString());

    if (typeof outerData.data === "string" && outerData.data.length) {
      const parsedInnerData = JSON.parse(outerData.data);

      outerData.data = parsedInnerData;
    }

    return outerData;
  } catch (e) {
    if (e instanceof Error) {
      console.warn(`Error on parse ws request! ${e.message}`);
    }

    return null;
  }
};
