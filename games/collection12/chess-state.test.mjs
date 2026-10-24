import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

function chess() {
  const ctx = vm.createContext({ console, Math });
  for (const name of ['chess', 'bitboard', 'zobrist', 'move', 'position', 'parser', 'ai']) {
    vm.runInContext(fs.readFileSync(new URL(`../../public/games/international-chess/${name}.js`, import.meta.url), 'utf8'), ctx);
  }
  return ctx.Chess;
}

function play(Chess, position, notation) {
  const moves = Chess.Parser.parseOneMove(position, notation);
  assert.equal(moves.length, 1, `走法应唯一且合法: ${notation}`);
  assert.equal(position.makeMove(moves[0]), true);
}

const snapshot = position => JSON.stringify(position);
const cycle = ['Nf3', 'Nf6', 'Ng1', 'Ng8'];

function fixture(Chess, entries, { enPassant = -1, castling = 0 } = {}) {
  const position = new Chess.Position();
  position.bitboards = Array.from({ length: 8 }, () => Chess.Bitboard.makeZero());
  for (const [square, piece, color] of entries) {
    const index = Chess.getIndexFromAlgebraic(square);
    position.bitboards[piece].setBit(index);
    position.bitboards[Chess.Position.ANY_WHITE + color].setBit(index);
  }
  position.enPassantSquare = enPassant;
  position.castlingRights = castling;
  position.fillPiecesFromBitboards();
  position.updateHashKey();
  return position;
}

test('国际象棋普通走子撤销恢复完整局面，包括半回合计数', () => {
  const Chess = chess(), position = new Chess.Position(), before = snapshot(position);
  play(Chess, position, 'Nf3');
  assert.equal(position.halfmoveClock, 1);
  position.unmakeMove();
  assert.equal(snapshot(position), before);
});

test('国际象棋撤销兵走子恢复此前未吃子、未动兵的回合数', () => {
  const Chess = chess(), position = Chess.Parser.parseMoves('Nf3 Nf6');
  const before = snapshot(position);
  play(Chess, position, 'e4'); assert.equal(position.halfmoveClock, 0);
  position.unmakeMove(); assert.equal(position.halfmoveClock, 2);
  assert.equal(snapshot(position), before);
});

test('国际象棋撤销吃子恢复计数及被吃棋子', () => {
  const Chess = chess(), position = Chess.Parser.parseMoves('e4 d5 Nf3 Nf6');
  const before = snapshot(position);
  play(Chess, position, 'exd5'); assert.equal(position.halfmoveClock, 0);
  position.unmakeMove(); assert.equal(snapshot(position), before);
});

test('国际象棋实际 AI 搜索只返回合法建议，不修改棋盘、计数或历史', () => {
  const Chess = chess(), position = new Chess.Position(), before = snapshot(position);
  const move = new Chess.AI().search(position);
  assert(move && position.isMoveLegal(move));
  assert.equal(snapshot(position), before);
});

test('国际象棋五十回合边界在撤销后立即恢复，不保留试走计数', () => {
  const Chess = chess(), position = new Chess.Position(); position.halfmoveClock = 98;
  play(Chess, position, 'Nf3'); assert.equal(position.isFiftyMoveRuleDraw(), false);
  play(Chess, position, 'Nf6'); assert.equal(position.halfmoveClock, 100); assert.equal(position.isFiftyMoveRuleDraw(), true);
  position.unmakeMove(); assert.equal(position.halfmoveClock, 99); assert.equal(position.isFiftyMoveRuleDraw(), false);
  position.unmakeMove(); assert.equal(position.halfmoveClock, 98);
});

test('国际象棋同一局面首次与第二次不重复判和，第三次应识别', () => {
  const Chess = chess(), position = new Chess.Position();
  assert.equal(position.isThreefoldRepetitionRuleDraw(), false);
  cycle.forEach(move => play(Chess, position, move)); assert.equal(position.isThreefoldRepetitionRuleDraw(), false);
  cycle.forEach(move => play(Chess, position, move)); assert.equal(position.isThreefoldRepetitionRuleDraw(), true);
  assert.equal(position.getStatus(), Chess.Position.Status.THREEFOLD_REPETITION_RULE_DRAW);
});

test('国际象棋撤销第三次重复后应恢复可继续状态，再走回仍识别重复', () => {
  const Chess = chess(), position = Chess.Parser.parseMoves([...cycle, ...cycle].join(' '));
  assert.equal(position.isThreefoldRepetitionRuleDraw(), true);
  position.unmakeMove(); assert.equal(position.getStatus(), Chess.Position.Status.NORMAL);
  play(Chess, position, 'Ng8'); assert.equal(position.isThreefoldRepetitionRuleDraw(), true);
});

test('国际象棋不可吃过路兵的双步兵记录，不应把相同可走局面误分为不同局面', () => {
  const Chess = chess(), position = Chess.Parser.parseMoves('a4 Nf6 Nf3 Ng8 Ng1 Nf6 Nf3 Ng8 Ng1');
  assert.equal(position.isThreefoldRepetitionRuleDraw(), true);
});

test('国际象棋实际可吃过路兵的局面与失去该权利的局面应区别计数', () => {
  const Chess = chess(), position = Chess.Parser.parseMoves('e4 a6 e5 d5');
  assert(position.getMoves().some(move => move.getKind() === Chess.Move.Kind.EN_PASSANT_CAPTURE));
  for (let repeat = 0; repeat < 2; repeat++) cycle.forEach(move => play(Chess, position, move));
  assert.equal(position.isThreefoldRepetitionRuleDraw(), false);
  cycle.forEach(move => play(Chess, position, move)); assert.equal(position.isThreefoldRepetitionRuleDraw(), true);
});

test('国际象棋被牵制而不合法的吃过路兵，不应造成重复局面漏判', () => {
  const Chess = chess(), position = fixture(Chess, [
    ['e1', Chess.Piece.KING, 0], ['g1', Chess.Piece.KNIGHT, 0], ['e5', Chess.Piece.PAWN, 0],
    ['a8', Chess.Piece.KING, 1], ['g8', Chess.Piece.KNIGHT, 1], ['e8', Chess.Piece.ROOK, 1], ['d5', Chess.Piece.PAWN, 1],
  ], { enPassant: Chess.getIndexFromAlgebraic('d5') });
  assert(position.generateMoves(true).some(move => move.getKind() === Chess.Move.Kind.EN_PASSANT_CAPTURE));
  assert(!position.getMoves().some(move => move.getKind() === Chess.Move.Kind.EN_PASSANT_CAPTURE));
  for (let repeat = 0; repeat < 2; repeat++) cycle.forEach(move => play(Chess, position, move));
  assert.equal(position.isThreefoldRepetitionRuleDraw(), true);
});

test('国际象棋王车易位权利不同的局面不能误合并为三次重复', () => {
  const Chess = chess(), position = fixture(Chess, [
    ['e1', Chess.Piece.KING, 0], ['h1', Chess.Piece.ROOK, 0], ['e8', Chess.Piece.KING, 1], ['g8', Chess.Piece.KNIGHT, 1],
  ], { castling: 1 });
  const moves = ['Rh2', 'Nf6', 'Rh1', 'Ng8'];
  for (let repeat = 0; repeat < 2; repeat++) moves.forEach(move => play(Chess, position, move));
  assert.equal(position.isThreefoldRepetitionRuleDraw(), false);
  moves.forEach(move => play(Chess, position, move)); assert.equal(position.isThreefoldRepetitionRuleDraw(), true);
});

test('国际象棋初始局面枚举保持既有合法走法数量并完整恢复状态', () => {
  const Chess = chess(), position = new Chess.Position(), before = snapshot(position);
  // Same expected counts as the pinned upstream src/test.js perft fixture.
  for (const [depth, expected] of [[1, 20], [2, 400], [3, 8902]]) {
    assert.equal(Chess.Position.perft(depth, position), expected);
    assert.equal(snapshot(position), before);
  }
});

test('国际象棋连续合法走子后逐步撤销，每一步都恢复完整状态', () => {
  const Chess = chess(), position = new Chess.Position(), states = [];
  for (let turn = 0; turn < 40; turn++) {
    const moves = position.getMoves(); if (!moves.length) break;
    states.push(snapshot(position)); assert(position.makeMove(moves[(turn * 37 + 11) % moves.length]));
  }
  assert(states.length >= 20);
  while (states.length) { position.unmakeMove(); assert.equal(snapshot(position), states.pop()); }
});
