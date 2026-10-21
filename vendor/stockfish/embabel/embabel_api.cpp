/*
  Library entry for running Stockfish as a pure-compute WebAssembly module.

  The module exports three functions and imports nothing:

    int32_t embabel_alloc(int32_t len);
    void    embabel_free(int32_t ptr, int32_t len);
    int64_t analyse(int32_t fen_ptr, int32_t fen_len, int32_t nodes, int32_t max_depth, int32_t multipv);

  analyse searches one position until it has spent `nodes` or finished `max_depth`, whichever
  comes first, and returns a JSON string as (ptr << 32 | len). The caller frees the result with
  embabel_free once it has copied it. Every call starts from cleared hash and histories, so the
  same position and budget always give the same answer.

  GPL-3.0, like the Stockfish sources it links against.
*/

#include <cstdint>
#include <cstdlib>
#include <cstring>
#include <sstream>
#include <string>
#include <vector>

#include "attacks.h"
#include "engine.h"
#include "movegen.h"
#include "position.h"
#include "score.h"
#include "search.h"
#include "uci.h"

using namespace Stockfish;

// Set by the search each time the main thread finishes an iteration (patch 0002).
namespace Stockfish { extern int embabelCompletedDepth; extern u64 embabelNodes; }

namespace {

Engine* engine = nullptr;

struct Line {
    int                      multipv = 0;
    bool                     mate    = false;
    int                      value   = 0;
    std::vector<std::string> pv;
};

std::vector<Line> lastBatch;

void ensure_engine() {
    if (engine)
        return;
    Attacks::init();
    Position::init();
    engine = new Engine(std::nullopt);
    engine->set_on_update_no_moves([](const Engine::InfoShort&) {});
    engine->set_on_iter([](const Engine::InfoIter&) {});
    engine->set_on_bestmove([](std::string_view, std::string_view) {});
    engine->set_on_verify_network([](std::string_view) {});
    engine->set_on_start([] {});
    engine->set_on_update_full([](const Engine::InfoFull& info) {
        // Each output_pv call reports lines 1..k in order, so line 1 starts a new batch.
        if (info.multiPV == 1)
            lastBatch.clear();
        Line l;
        l.multipv = int(info.multiPV);
        info.score.visit([&](auto s) {
            using T = decltype(s);
            if constexpr (std::is_same_v<T, Score::Mate>)
            {
                l.mate  = true;
                l.value = (s.plies > 0 ? (s.plies + 1) : s.plies) / 2;
            }
            else if constexpr (std::is_same_v<T, Score::Tablebase>)
                l.value = (s.win ? 20000 : -20000) - s.plies;
            else
                l.value = s.value;
        });
        std::istringstream is{std::string(info.pv)};
        for (std::string m; is >> m;)
            l.pv.push_back(m);
        lastBatch.push_back(std::move(l));
    });
}

void set_option(const std::string& name, const std::string& value) {
    std::istringstream is("name " + name + " value " + value);
    engine->get_options().setoption(is);
}

char piece_letter(PieceType pt) { return " PNBRQK"[pt]; }

// Standard algebraic notation for a legal move in pos.
std::string to_san(Position& pos, Move m) {
    std::string san;
    const Square from = m.from_sq(), to = m.to_sq();
    const PieceType pt = type_of(pos.moved_piece(m));

    if (m.type_of() == CASTLING)
        san = to > from ? "O-O" : "O-O-O";
    else
    {
        const bool capture = pos.capture(m);
        if (pt == PAWN)
        {
            if (capture)
                san += char('a' + file_of(from));
        }
        else
        {
            san += piece_letter(pt);
            bool sameFile = false, sameRank = false, ambiguous = false;
            for (const auto& other : MoveList<LEGAL>(pos))
            {
                Move o = other;
                if (o == m || o.to_sq() != to || o.type_of() == CASTLING
                    || type_of(pos.moved_piece(o)) != pt)
                    continue;
                ambiguous = true;
                if (file_of(o.from_sq()) == file_of(from))
                    sameFile = true;
                if (rank_of(o.from_sq()) == rank_of(from))
                    sameRank = true;
            }
            if (ambiguous)
            {
                if (!sameFile)
                    san += char('a' + file_of(from));
                else if (!sameRank)
                    san += char('1' + rank_of(from));
                else
                {
                    san += char('a' + file_of(from));
                    san += char('1' + rank_of(from));
                }
            }
        }
        if (capture)
            san += 'x';
        san += char('a' + file_of(to));
        san += char('1' + rank_of(to));
        if (m.type_of() == PROMOTION)
        {
            san += '=';
            san += piece_letter(m.promotion_type());
        }
    }

    if (pos.gives_check(m))
    {
        StateInfo st;
        pos.do_move(m, st, nullptr);
        san += MoveList<LEGAL>(pos).size() ? '+' : '#';
        pos.undo_move(m);
    }
    return san;
}

void json_string(std::string& out, const std::string& s) {
    out += '"';
    for (char c : s)
    {
        if (c == '"' || c == '\\')
        {
            out += '\\';
            out += c;
        }
        else if (static_cast<unsigned char>(c) < 0x20)
            out += ' ';
        else
            out += c;
    }
    out += '"';
}

int64_t pack(const std::string& json) {
    const auto len = static_cast<uint32_t>(json.size());
    auto*      buf = static_cast<char*>(std::malloc(len ? len : 1));
    std::memcpy(buf, json.data(), len);
    return (int64_t(uint32_t(reinterpret_cast<uintptr_t>(buf))) << 32) | int64_t(len);
}

int64_t error(const std::string& message) {
    std::string out = "{\"error\":";
    json_string(out, message);
    out += '}';
    return pack(out);
}

}  // namespace

extern "C" {

__attribute__((export_name("embabel_alloc"))) int32_t embabel_alloc(int32_t len) {
    if (len <= 0)
        return 0;
    return int32_t(reinterpret_cast<uintptr_t>(std::malloc(size_t(len))));
}

__attribute__((export_name("embabel_free"))) void embabel_free(int32_t ptr, int32_t len) {
    (void) len;
    if (ptr)
        std::free(reinterpret_cast<void*>(uintptr_t(uint32_t(ptr))));
}

__attribute__((export_name("analyse"))) int64_t
analyse(int32_t fen_ptr, int32_t fen_len, int32_t nodes, int32_t max_depth, int32_t multipv) {
    if (fen_len < 0 || fen_len > 4096)
        return error("fen length out of range");
    if (nodes <= 0)
        return error("nodes must be positive");
    if (max_depth <= 0 || max_depth > 245)
        return error("max_depth must be between 1 and 245");
    if (multipv <= 0 || multipv > 64)
        return error("multipv must be between 1 and 64");

    const std::string fen(reinterpret_cast<const char*>(uintptr_t(uint32_t(fen_ptr))), size_t(fen_len));

    ensure_engine();

    // Validate the FEN on a scratch position first so a bad one never reaches the engine.
    {
        StateInfo st;
        Position  p;
        if (auto err = p.set(fen, false, &st); err.has_value())
            return error(std::string("bad fen: ") + err->what());
        if (!p.pos_is_ok())
            return error("bad fen: position is not legal");
        if (MoveList<LEGAL>(p).size() == 0)
            return error("no legal moves in this position");
    }

    set_option("MultiPV", std::to_string(multipv));
    engine->search_clear();
    if (auto err = engine->set_position(fen, {}); err.has_value())
        return error(std::string("bad fen: ") + err->what());

    lastBatch.clear();
    embabelCompletedDepth = 0;
    embabelNodes          = 0;

    Search::LimitsType limits;
    limits.startTime = 0;
    limits.nodes     = u64(nodes);
    limits.depth     = max_depth;
    engine->go(limits);
    engine->wait_for_search_finished();

    // Searched nodes are read back from the line batch's source: the engine's own counter.
    StateInfo st;
    Position  pos;
    pos.set(fen, false, &st);

    std::string out = "{\"depth\":" + std::to_string(embabelCompletedDepth)
                    + ",\"nodes\":" + std::to_string(embabelNodes) + ",\"lines\":[";
    bool first = true;
    for (const auto& l : lastBatch)
    {
        if (l.pv.empty())
            continue;
        Move m = UCIEngine::to_move(pos, l.pv.front());
        if (m == Move::none())
            continue;
        if (!first)
            out += ',';
        first = false;
        out += "{\"rank\":" + std::to_string(l.multipv) + ",\"san\":";
        json_string(out, to_san(pos, m));
        out += ",\"uci\":";
        json_string(out, l.pv.front());
        out += ",\"cp\":" + (l.mate ? std::string("null") : std::to_string(l.value));
        out += ",\"mate\":" + (l.mate ? std::to_string(l.value) : std::string("null"));
        out += ",\"pv\":[";
        for (size_t i = 0; i < l.pv.size(); ++i)
        {
            if (i)
                out += ',';
            json_string(out, l.pv[i]);
        }
        out += "]}";
    }
    out += "]}";
    return pack(out);
}

}  // extern "C"
