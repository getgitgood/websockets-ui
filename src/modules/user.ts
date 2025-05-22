import {
  EventType,
  RegEventCredentials,
  SocketWithUser,
  WinnerEntity,
} from "types";

import { db } from "../db";
import { createMessage, logMessage } from "misc/helpers";
import { roomModule } from "./room";

export const userModule = {
  addUser(data: RegEventCredentials, socket: SocketWithUser) {
    const { name, password } = data as RegEventCredentials;
    const index = db.users.length;
    const response = {
      ...data,
      error: false,
      errorText: "",
      index,
    };

    const existedUser = db.users.find((user) => user.name === name);

    if (existedUser && existedUser.password !== password) {
      response.error = true;
      response.errorText = `User with name ${name} already exists!`;

      socket.send(createMessage({ type: "reg", data: response }));

      logMessage({ type: "reg", data: response });

      return;
    }

    const winCount = db.winners.find((winner) => winner.name === name);

    const user = { ...data, index };
    db.users.push(user);

    socket.user = user;

    db.usersWs.set(name, socket);

    socket.send(createMessage({ type: "reg", data: response }));

    logMessage({ type: "reg", data: response });

    this.updateWinners({ name: user.name, wins: winCount?.wins || 0 });
  },

  updateWinners(winner: WinnerEntity) {
    const winners = db.winners;
    const user = winners.find((user) => user.name === winner.name);

    if (!user) winners.push(winner);
    else {
      const index = winners.indexOf(user);

      winners[index].wins = winner.wins;
    }

    const sortedWinners = [...winners].sort((a, b) => b.wins - a.wins);
    const event = { type: "update_winners" as EventType, data: sortedWinners };

    const message = createMessage(event);

    let index = 0;

    db.usersWs.forEach((ws, _, map) => {
      index += 1;
      roomModule.updateRoom(ws, index === map.size);
      ws.send(message);
    });

    logMessage({ type: "update_winners", data: event });
  },
};
