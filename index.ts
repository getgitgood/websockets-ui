import WebSocket, { WebSocketServer } from "ws";
import { httpServer } from "./src/http_server/index.js";
import {
  RawEvent,
  EventType,
  RegEventCredentials,
  UserEntity,
  AddUserToRoomEvent,
  IndexRoom,
  AddShipsEventData,
} from "./src/types";
import { db } from "./src/db";

const HTTP_PORT = 8181;
const WS_PORT = 3000;

console.log(`Start static http server on the ${HTTP_PORT} port!`);

const wss = new WebSocketServer({ port: WS_PORT });

wss.once("connection", (ws) => {
  console.log(`WebSocket connection established! \nConnection info:`);
  console.table([
    {
      "Connected on port": WS_PORT,
      "Is in ready state?": ws.readyState === 1,
      "Is paused?": ws.isPaused,
    },
  ]);
});

wss.on("connection", (ws: WebSocket & { user: UserEntity }, req) => {
  ws.on("message", (data: WebSocket.Data) => {
    const wsEvent = parseWsEvent<RawEvent>(data);

    if (wsEvent) {
      const { type, data } = wsEvent as {
        type: EventType;
        data: unknown;
      };
      try {
        switch (type) {
          case "reg": {
            const user: UserEntity = db.addPlayer(
              data as RegEventCredentials,
              ws
            );
            const response = { ...wsEvent, data: JSON.stringify(user) };

            ws.user = user;
            ws.send(JSON.stringify(response));
            const usersWs = db.getUsersWs();

            if (usersWs)
              usersWs.forEach((ws) => {
                ws.send(db.roomsList);
                ws.send(db.updateWinners({ name: user.name, wins: 0 }));
              });

            break;
          }

          case "create_room": {
            const { user } = ws;
            db.createRoom(user);

            const usersWs = db.getUsersWs();

            if (usersWs) usersWs.forEach((ws) => ws.send(db.roomsList));

            break;
          }

          case "add_user_to_room": {
            const { indexRoom } = data as IndexRoom;

            db.addUserToRoom(indexRoom, ws.user.name);
            const session = db.createGame(indexRoom);

            if (session) {
              const [user1, user2] = session;

              user1.ws.send(user1.message);
              user2.ws.send(user2.message);
            }

            const usersWs = db.getUsersWs();

            if (usersWs.size === 2)
              usersWs.forEach((ws) => {
                ws.send(db.roomsList);
              });

            break;
          }

          case "add_ships": {
            const { gameId, ships, indexPlayer } = data as AddShipsEventData;
            const bothPlayersReady = db.addShips(gameId, indexPlayer, ships);

            if (!bothPlayersReady) return;

            const users = db.startGame(gameId);

            if (!users?.length)
              throw new Error(
                "Cannot start game, WebSockets assembled incorrectly!"
              );

            const [user1, user2] = users;

            user1.ws.send(user1.message);
            user2.ws.send(user2.message);

            const turn = db.getCurrentTurn(gameId);

            if (!turn)
              throw new Error("Error on calculation player's turn order!");

            const [turn1, turn2] = turn;

            turn1.ws.send(turn1.message);
            turn2.ws.send(turn2.message);
          }
          default:
            break;
        }
      } catch (e) {
        if (e instanceof Error) {
          console.warn(e.message);
        }

        console.log(e);
      }
    }
    // console.log(db.storage.users);
  });
});

const parseWsEvent = <T>(data: WebSocket.Data): T | null => {
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

httpServer.listen(HTTP_PORT);

httpServer.on("close", () => {
  httpServer.close();
});
