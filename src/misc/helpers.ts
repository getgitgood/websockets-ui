import {
  AttackResult,
  Coords,
  EventType,
  ShipCoordinates,
  ShipsData,
  SocketWithUser,
} from "types";
import { styleText } from "util";

const calculateShipCoords = (start: number, length: number) =>
  Array.from({ length }, (_, i) => start + i);

const calculateSurroundingCells = (xArr: number[], yArr: number[]) => {
  const surrounding: Coords[] = [];

  for (let kx = -1; kx <= 1; kx += 1) {
    for (let ky = -1; ky <= 1; ky += 1) {
      for (const x of xArr) {
        for (const y of yArr) {
          const nx = x + kx;
          const ny = y + ky;

          if (xArr.includes(nx) && yArr.includes(ny)) continue;

          if (nx < 0 || nx > 9 || ny < 0 || ny > 9) continue;

          if (surrounding.some(({ x, y }) => x === nx && y === ny)) continue;

          surrounding.push({ x: nx, y: ny });
        }
      }
    }
  }

  return surrounding;
};

export const getShipCoords = (ships: ShipsData[]): ShipCoordinates[] =>
  ships.map((ship) => {
    const { position: pos, direction, length } = ship;
    const position: ShipCoordinates = {
      ...ship,
      x: [],
      y: [],
      hits: [],
      surrounding: [],
    };

    if (direction) {
      position.x.push(pos.x);
      position.y = calculateShipCoords(pos.y, length);
    } else {
      position.y.push(pos.y);
      position.x = calculateShipCoords(pos.x, length);
    }

    position.surrounding = calculateSurroundingCells(position.x, position.y);

    return position;
  });

export const checkHit = ({
  x,
  y,
  ships,
  currentPlayer,
}: Coords & {
  ships: ShipCoordinates[];
  currentPlayer: string;
}) => {
  const result: AttackResult = {
    position: { x, y },
    currentPlayer,
    status: "miss",
  };
  const ship = ships.find((ship) => ship.x.includes(x) && ship.y.includes(y));

  if (!ship) return { result, surrounding: null, hits: null };

  result.status = "shot";

  ship.hits.push({ x, y });

  if (!ship.direction) {
    ship.x = ship.x.filter((coord) => coord !== x);
    if (ship.x.length === 0) {
      ship.y = [];
      result.status = "killed";
    }
  } else {
    ship.y = ship.y.filter((coord) => coord !== y);
    if (ship.y.length === 0) {
      ship.x = [];
      result.status = "killed";
    }
  }

  return {
    result,
    surrounding: ship.surrounding!,
    hits: ship.hits,
  };
};

type CreateMessageArgs = { type: EventType; data: unknown; incoming?: boolean };

export const createMessage = ({ type, data }: CreateMessageArgs) =>
  JSON.stringify({
    type,
    data: JSON.stringify(data),
    id: 0,
  });

export const logMessage = ({ type, data, incoming }: CreateMessageArgs) => {
  console.log(
    `${styleText(
      incoming ? "bgGreen" : "bgBlue",
      ` ${incoming ? "<---" : ""} WS event "${type}" ${incoming ? "" : "--->"} `
    )} ${styleText("dim", `${JSON.stringify(data, undefined, 2)}`)}`
  , '\n');
};

const battleFields = (() => {
  const arr: Coords[] = [];

  for (let x = 0; x < 10; x++) {
    for (let y = 0; y < 10; y++) {
      arr.push({ x, y });
      arr.push({ x: y, y: x });
    }
  }

  return arr.filter(
    (k, i) => arr.findIndex((j) => k.x === j.x && k.y === j.y) === i
  );
})();

export { battleFields };
