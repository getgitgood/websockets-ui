import WebSocket, { WebSocketServer } from "ws";
import { httpServer } from "./src/http_server/index.ts";
import {
  RawEvent,
  EventType,
  UserEntity,
  IndexRoom,
  AddShipsEventData,
  AttackData,
  parseWsEvent,
} from "./src/types";
import { gameModule, roomModule, shipsModule, userModule } from "./src/modules";
import { logMessage } from "./src/misc/helpers.ts";
import { db } from "./src/db";
import { styleText } from "util";

const HTTP_PORT = 8181;
const WS_PORT = 3000;

console.log(`Start static http server on the ${HTTP_PORT} port!`);

const wss = new WebSocketServer({ port: WS_PORT });
console.log(styleText("bgBlue", `WebSocket connection established!`));
console.log(styleText("bgBlue", `Connection info:`));
console.table(wss.options);

console.log(styleText("bgGreen", `Awaiting for connections...`));

wss.on("connection", (ws: WebSocket & { user: UserEntity }) => {
  console.log(styleText("bgBlueBright", `User connected`));

  ws.on("message", (data: WebSocket.Data) => {
    const wsEvent = parseWsEvent<RawEvent>(data);

    if (wsEvent) {
      const { type, data } = wsEvent as {
        type: EventType;
        data: unknown;
      };

      logMessage({ type, data: JSON.stringify(data), incoming: true });

      try {
        switch (type) {
          case "reg": {
            userModule.addUser(data, ws);

            break;
          }

          case "create_room": {
            const { user } = ws;

            roomModule.createRoom(user);

            break;
          }

          case "add_user_to_room": {
            const { indexRoom } = data as IndexRoom;

            roomModule.addUserToRoom(indexRoom, ws.user.name);
            roomModule.createGame(indexRoom);

            break;
          }

          case "add_ships": {
            const { gameId, ships, indexPlayer } = data as AddShipsEventData;

            shipsModule.addShips({
              gameId,
              indexPlayer,
              ships,
              socket: ws,
            });

            const bothPlayersReady = shipsModule.startGame(gameId);

            if (bothPlayersReady) gameModule.turn(gameId);

            break;
          }

          case "attack": {
            const attackResult = gameModule.attack(data);

            if (attackResult === "endGame" || !attackResult) return;

            const { gameId, indexPlayer } = data as AttackData;

            gameModule.turn(gameId, indexPlayer, attackResult === "miss");

            break;
          }
          case "randomAttack": {
            const { gameId, indexPlayer } = data as AttackData;
            const randomAttackResult = gameModule.randomAttack(
              gameId,
              indexPlayer
            );

            if (randomAttackResult === "endGame" || !randomAttackResult) return;

            gameModule.turn(gameId, indexPlayer, randomAttackResult === "miss");

            break;
          }
          default:
            break;
        }
      } catch (e) {
        if (e instanceof Error) console.warn(e.message);
        else console.log(e);
      }
    }
  });
});

httpServer.listen(HTTP_PORT);

httpServer.on("close", () => {
  db.usersWs.forEach((socket, user) => {
    socket.close();

    console.log(
      styleText("dim", `WS Connection for user ${user} has been closed.`)
    );
  });

  console.log(styleText("green", `WS Server gracefully shutdown.`));
  wss.close();
  console.log(styleText("green", `Http Server gracefully shutdown.`));
  process.exit();
});
