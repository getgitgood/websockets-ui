export type EventType =
  | "reg"
  | "update_winners"
  | "create_room"
  | "add_user_to_room"
  | "create_game"
  | "update_room"
  | "add_ships"
  | "start_game"
  | "turn"
  | "attack";

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
  ships: ShipsData;
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
