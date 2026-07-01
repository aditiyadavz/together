import React from "react";

export default function GamePanel({ visible, game, userId, onClaim, onMove, onReset }) {
  const myX = game.players.X === userId;
  const myO = game.players.O === userId;
  const myTurnSymbol = myX ? "X" : myO ? "O" : null;
  const canPlay = myTurnSymbol && myTurnSymbol === game.turn && !game.winner;

  let banner;
  if (game.winner === "draw") banner = "It's a draw!";
  else if (game.winner) banner = <><b>{game.winner}</b> wins! 🎉</>;
  else if (!game.players.X || !game.players.O) banner = "Waiting for both players to claim a side…";
  else
    banner = (
      <>
        Turn: <b>{game.turn}</b> {myTurnSymbol === game.turn ? "(you!)" : ""}
      </>
    );

  return (
    <div className="panel" style={{ display: visible ? "block" : "none" }}>
      <h2 className="display">🎮 Tic-tac-toe</h2>
      <div className="sub">Claim a side, then take turns — moves sync live.</div>

      <div className="claim-row">
        <button
          className={"claim-btn" + (myX ? " mine" : "") + (game.players.X && !myX ? " taken" : "")}
          onClick={() => onClaim("X")}
        >
          {game.players.X ? (myX ? "You are X" : "X taken") : "Play as X"}
        </button>
        <button
          className={"claim-btn" + (myO ? " mine" : "") + (game.players.O && !myO ? " taken" : "")}
          onClick={() => onClaim("O")}
        >
          {game.players.O ? (myO ? "You are O" : "O taken") : "Play as O"}
        </button>
      </div>

      <div className="turn-banner">{banner}</div>

      <div className="board">
        {game.board.map((val, i) => (
          <div
            key={i}
            className={
              "cell" +
              (val ? " filled " + val.toLowerCase() : "") +
              (!canPlay || val ? " disabled" : "") +
              (game.line && game.line.includes(i) ? " win" : "")
            }
            onClick={() => canPlay && !val && onMove(i)}
          >
            {val || ""}
          </div>
        ))}
      </div>

      <button className="btn-ghost center-btn" onClick={onReset}>
        New game
      </button>
    </div>
  );
}
