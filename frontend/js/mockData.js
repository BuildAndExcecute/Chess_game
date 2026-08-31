/* ==========================================================================
   MOCK DATA - REALISTIC FIXTURES FOR DEVELOPMENT & DEMONSTRATION
   ========================================================================== */

const MOCK_CURRENT_USER = {
  id: "usr_alex_007",
  username: "GrandmasterAlex",
  email: "alex.grandmaster@example.com",
  avatarUrl: null,
  initials: "GA",
  rating: 1540,
  country: "US",
  countryFlag: "US",
  joinedDate: "January 2025",
  stats: {
    gamesPlayed: 148,
    wins: 86,
    losses: 48,
    draws: 14,
    winRate: "58.1%"
  }
};

const MOCK_AI_BOTS = [
  { id: "ai_easy", name: "Novice Bot", rating: 800, description: "Friendly practice partner making straightforward moves." },
  { id: "ai_medium", name: "Tactical Engine v1", rating: 1400, description: "Solid positional play and quick tactical vision." },
  { id: "ai_hard", name: "Deep Chess AI", rating: 2100, description: "Formidable engine calculating deep attacking variations." }
];

const MOCK_MATCH_HISTORY = [
  {
    id: "match_8921",
    date: "2026-08-24",
    time: "21:40",
    timeControl: "10 min",
    opponent: {
      id: "usr_shadow_99",
      username: "ShadowKnight",
      rating: 1515,
      avatarUrl: null,
      initials: "SK",
      countryFlag: "GB"
    },
    userColor: "white",
    result: "win",
    resultType: "Checkmate",
    eloChange: "+14",
    moveCount: 16,
    moves: [
      { from: "e2", to: "e4", piece: "white-pawn", notation: "e4", fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1" },
      { from: "e7", to: "e5", piece: "black-pawn", notation: "e5", fen: "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2" },
      { from: "g1", to: "f3", piece: "white-knight", notation: "Nf3", fen: "rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2" },
      { from: "b8", to: "c6", piece: "black-knight", notation: "Nc6", fen: "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3" },
      { from: "f1", to: "c4", piece: "white-bishop", notation: "Bc4", fen: "r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3" },
      { from: "f8", to: "c5", piece: "black-bishop", notation: "Bc5", fen: "r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4" },
      { from: "c2", to: "c3", piece: "white-pawn", notation: "c3", fen: "r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/2P2N2/PP1P1PPP/RNBQK2R b KQkq - 0 4" },
      { from: "g8", to: "f6", piece: "black-knight", notation: "Nf6", fen: "r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/2P2N2/PP1P1PPP/RNBQK2R w KQkq - 1 5" },
      { from: "d2", to: "d4", piece: "white-pawn", notation: "d4", fen: "r1bqk2r/pppp1ppp/2n2n2/2b1p3/2BPP3/2P2N2/PP3PPP/RNBQK2R b KQkq d3 0 5" },
      { from: "e5", to: "d4", piece: "black-pawn", notation: "exd4", fen: "r1bqk2r/pppp1ppp/2n2n2/2b5/2BpP3/2P2N2/PP3PPP/RNBQK2R w KQkq - 0 6" },
      { from: "e4", to: "e5", piece: "white-pawn", notation: "e5", fen: "r1bqk2r/pppp1ppp/2n2n2/2b1P3/2Bp4/2P2N2/PP3PPP/RNBQK2R b KQkq - 0 6" },
      { from: "d7", to: "d5", piece: "black-pawn", notation: "d5", fen: "r1bqk2r/ppp2ppp/2n2n2/2bpP3/2Bp4/2P2N2/PP3PPP/RNBQK2R w KQkq d6 0 7" },
      { from: "e5", to: "f6", piece: "white-pawn", notation: "exf6", fen: "r1bqk2r/ppp2ppp/2n2P2/2bp4/2Bp4/2P2N2/PP3PPP/RNBQK2R b KQkq - 0 7" },
      { from: "d5", to: "c4", piece: "black-pawn", notation: "dxc4", fen: "r1bqk2r/ppp2ppp/2n2P2/2b5/2pp4/2P2N2/PP3PPP/RNBQK2R w KQkq - 0 8" },
      { from: "d1", to: "e2", piece: "white-queen", notation: "Qe2+", fen: "r1bqk2r/ppp2ppp/2n2P2/2b5/2pp4/2P2N2/PP2QPPP/RNB1K2R b KQkq - 1 8" },
      { from: "c8", to: "e6", piece: "black-bishop", notation: "Be6#", fen: "r2qk2r/ppp2ppp/2n1bP2/2b5/2pp4/2P2N2/PP2QPPP/RNB1K2R w KQkq - 2 9" }
    ]
  },
  {
    id: "match_8842",
    date: "2026-08-23",
    time: "18:15",
    timeControl: "5 min",
    opponent: {
      id: "usr_chess_master",
      username: "ChessMaster99",
      rating: 1620,
      avatarUrl: null,
      initials: "CM",
      countryFlag: "DE"
    },
    userColor: "black",
    result: "loss",
    resultType: "Resignation",
    eloChange: "-11",
    moveCount: 10,
    moves: [
      { from: "d2", to: "d4", piece: "white-pawn", notation: "d4" },
      { from: "g8", to: "f6", piece: "black-knight", notation: "Nf6" },
      { from: "c2", to: "c4", piece: "white-pawn", notation: "c4" },
      { from: "e7", to: "e6", piece: "black-pawn", notation: "e6" },
      { from: "b1", to: "c3", piece: "white-knight", notation: "Nc3" },
      { from: "f8", to: "b4", piece: "black-bishop", notation: "Bb4" },
      { from: "e2", to: "e3", piece: "white-pawn", notation: "e3" },
      { from: "e8", to: "g8", piece: "black-king", notation: "O-O" },
      { from: "f1", to: "d3", piece: "white-bishop", notation: "Bd3" },
      { from: "d7", to: "d5", piece: "black-pawn", notation: "d5" }
    ]
  },
  {
    id: "match_8790",
    date: "2026-08-22",
    time: "14:30",
    timeControl: "15 min",
    opponent: {
      id: "usr_vortex_7",
      username: "VortexGambit",
      rating: 1530,
      avatarUrl: null,
      initials: "VG",
      countryFlag: "FR"
    },
    userColor: "white",
    result: "draw",
    resultType: "Agreement",
    eloChange: "+1",
    moveCount: 8,
    moves: [
      { from: "e2", to: "e4", piece: "white-pawn", notation: "e4" },
      { from: "c7", to: "c5", piece: "black-pawn", notation: "c5" },
      { from: "g1", to: "f3", piece: "white-knight", notation: "Nf3" },
      { from: "d7", to: "d6", piece: "black-pawn", notation: "d6" },
      { from: "d2", to: "d4", piece: "white-pawn", notation: "d4" },
      { from: "c5", to: "d4", piece: "black-pawn", notation: "cxd4" },
      { from: "f3", to: "d4", piece: "white-knight", notation: "Nxd4" },
      { from: "g8", to: "f6", piece: "black-knight", notation: "Nf6" }
    ]
  }
];

const INITIAL_BOARD_POSITION = {
  a8: "black-rook", b8: "black-knight", c8: "black-bishop", d8: "black-queen",
  e8: "black-king", f8: "black-bishop", g8: "black-knight", h8: "black-rook",
  a7: "black-pawn", b7: "black-pawn", c7: "black-pawn", d7: "black-pawn",
  e7: "black-pawn", f7: "black-pawn", g7: "black-pawn", h7: "black-pawn",
  
  a2: "white-pawn", b2: "white-pawn", c2: "white-pawn", d2: "white-pawn",
  e2: "white-pawn", f2: "white-pawn", g2: "white-pawn", h2: "white-pawn",
  a1: "white-rook", b1: "white-knight", c1: "white-bishop", d1: "white-queen",
  e1: "white-king", f1: "white-bishop", g1: "white-knight", h1: "white-rook"
};

// Export to window
if (typeof window !== 'undefined') {
  window.MOCK_CURRENT_USER = MOCK_CURRENT_USER;
  window.MOCK_AI_BOTS = MOCK_AI_BOTS;
  window.MOCK_MATCH_HISTORY = MOCK_MATCH_HISTORY;
  window.INITIAL_BOARD_POSITION = INITIAL_BOARD_POSITION;
}
