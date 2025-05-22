import { SocketWithUser, UserEntity } from "types";
import { db } from "../db";
import { createMessage, logMessage } from "misc/helpers";
import { createHash, randomUUID } from "crypto";

export const roomModule = {
  createRoom(user: Required<UserEntity>) {
    const { name, index } = user;
    const roomId = `${name}-room`;
    const rooms = db.rooms;

    if (rooms.some((room) => room.roomId === roomId))
      throw new Error(`Room with a same id "${roomId}" already exists!`);

    db.rooms.push({
      roomId,
      roomUsers: [{ name, index }],
    });

    db.usersWs.forEach((ws) => {
      this.updateRoom(ws, false);
    });

    logMessage({ type: "create_room", data: "" });
  },

  addUserToRoom(indexRoom: string, username: string) {
    const room = db.rooms.find((room) => room.roomId === indexRoom);

    if (!room) throw new Error(`Room with id "${indexRoom}" not found!`);

    const user = db.users.find((user) => user.name === username);

    if (user?.index === undefined) {
      console.warn(`User with name "${username}" not found!`);

      return;
    }

    room.roomUsers.push({ name: user.name, index: user.index });

    logMessage({ type: "add_user_to_room", data: { indexRoom } });
  },

  createGame(roomId: string) {
    const room = db.rooms.find((room) => room.roomId === roomId);

    if (!room) throw new Error(`Room with id ${roomId} not found!`);

    const { roomUsers } = room;
    const users = roomUsers.map(({ name }) => name);

    const [username1, username2] = users;

    const ws1 = db.usersWs.get(username1);
    const ws2 = db.usersWs.get(username2);

    if (!ws1 || !ws2) throw new Error("Ws missing");

    const idGame = `${roomId}-session`;
    const uuid1 = randomUUID();
    const uuid2 = randomUUID();

    db.userUuids.set(uuid1, username1);
    db.userUuids.set(uuid2, username2);

    ws1.send(
      createMessage({ type: "create_game", data: { idGame, idPlayer: uuid1 } })
    );
    ws2.send(
      createMessage({ type: "create_game", data: { idGame, idPlayer: uuid2 } })
    );

    db.usersWs.forEach((ws) => this.updateRoom(ws));

    logMessage({
      type: "create_game",
      data: [
        { idGame, idPlayer: uuid1 },
        { idGame, idPlayer: uuid2 },
      ],
    });
  },

  updateRoom(socket: SocketWithUser, withLoggerMessage = false) {
    const readyRooms = db.rooms.filter(
      ({ roomUsers }) => roomUsers.length === 1
    );

    if (withLoggerMessage)
      logMessage({ type: "update_room", data: readyRooms });

    socket.send(
      JSON.stringify({
        type: "update_room",
        data: JSON.stringify(readyRooms),
        index: 0,
      })
    );
  },
};
