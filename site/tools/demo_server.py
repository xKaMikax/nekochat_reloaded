"""A server with demo games for trying the spectator page (never used in production):
  PYTHONPATH=. RELOADED_DB=/tmp/demo.db .venv/bin/uvicorn --app-dir site/tools demo_server:app --port 8012
It opens a Reversi game with a played log; the watch address is printed."""
import random
import time

from app import main as m

random.seed(7)
DIRS = [(-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, -1), (1, 0), (1, 1)]


def flips(board, r, c, side):
    if board[r][c]:
        return []
    taken = []
    for dr, dc in DIRS:
        line, y, x = [], r + dr, c + dc
        while 0 <= y < 8 and 0 <= x < 8 and board[y][x] == -side:
            line.append((y, x)); y += dr; x += dc
        if line and 0 <= y < 8 and 0 <= x < 8 and board[y][x] == side:
            taken += line
    return taken


def reversi_entries(host, guest, moves):
    board = [[0] * 8 for _ in range(8)]
    board[3][3] = board[4][4] = -1
    board[3][4] = board[4][3] = 1
    log = [{"seq": 1, "from": guest[0], "name": guest[1], "kind": "join", "payload": None, "at": int(time.time())},
           {"seq": 2, "from": host[0], "name": host[1], "kind": "start", "payload": {"first": host[0]}, "at": int(time.time())}]
    side, ids = 1, {1: host[0], -1: guest[0]}
    names = {host[0]: host[1], guest[0]: guest[1]}
    for _ in range(moves):
        options = [(r, c) for r in range(8) for c in range(8) if flips(board, r, c, side)]
        if not options:
            side = -side
            options = [(r, c) for r in range(8) for c in range(8) if flips(board, r, c, side)]
            if not options:
                break
        r, c = random.choice(options)
        for y, x in flips(board, r, c, side):
            board[y][x] = side
        board[r][c] = side
        log.append({"seq": len(log) + 1, "from": ids[side], "name": names[ids[side]], "kind": "move", "payload": {"r": r, "c": c}, "at": int(time.time())})
        side = -side
    return log


def demo(game_id, addon, host, guest, log):
    m._games[game_id] = {"id": game_id, "server": m.NEKOCHAT_SERVERS[0], "game": addon, "chat": "dm:2", "host": host[0], "host_name": host[1],
                         "audience": {host[0], guest[0]}, "log": log, "seq": len(log), "closed": False, "created": int(time.time()) - 600,
                         "touched": time.time() + 3600, "watch": f"demo-{addon}", "viewers": {}}


def simple_log(host, guest, moves):
    now = int(time.time())
    log = [{"seq": 1, "from": guest[0], "name": guest[1], "kind": "join", "payload": None, "at": now},
           {"seq": 2, "from": host[0], "name": host[1], "kind": "start", "payload": {"first": host[0]}, "at": now}]
    for who, kind, payload in moves:
        person = host if who == 1 else guest
        log.append({"seq": len(log) + 1, "from": person[0], "name": person[1], "kind": kind, "payload": payload, "at": now})
    return log


m.migrate()
demo("demo-session-2", "checkers", (1, "KaMika"), (2, "Komdu"), simple_log((1, "KaMika"), (2, "Komdu"), [
    (1, "move", {"path": [[5, 0], [4, 1]]}), (2, "move", {"path": [[2, 1], [3, 0]]}), (1, "move", {"path": [[5, 2], [4, 3]]}), (2, "move", {"path": [[2, 3], [3, 2]]})]))
demo("demo-session-3", "backgammon", (1, "KaMika"), (2, "Komdu"), simple_log((1, "KaMika"), (2, "Komdu"), [(1, "roll", {"d": [3, 1]})]))
def card(s, r):
    return {"s": s, "r": r}


def hearts_view(host_names):
    hidden = lambda n: [{} for _ in range(n)]
    return {"round": 1, "phase": "play", "passDir": 3, "turn": 2, "trick": [{"p": 1, "card": card(2, 11)}, {"p": 0, "card": card(2, 14)}], "broken": False, "first": False, "over": False,
            "hands": [hidden(12), hidden(12), hidden(13), hidden(13)], "names": host_names, "scores": [12, 3, 20, 0], "history": [[12, 3, 20, 0]],
            "passed": [False, False, False, False], "event": None}


def spades_view(names):
    hidden = lambda n: [{} for _ in range(n)]
    return {"round": 1, "phase": "play", "turn": 1, "trick": [{"p": 0, "card": card(3, 12)}], "broken": False, "over": False,
            "hands": [hidden(12), hidden(13), hidden(13), hidden(13)], "names": names, "bids": [3, 2, 4, 1], "tricks": [1, 0, 0, 0],
            "scores": [0, 0], "bags": [0, 0], "history": [], "event": None}


def host_log(host, guest, view):
    now = int(time.time())
    return [{"seq": 1, "from": guest[0], "name": guest[1], "kind": "join", "payload": None, "at": now},
            {"seq": 2, "from": host[0], "name": host[1], "kind": "view", "payload": view, "at": now}]


m.migrate()
demo("demo-session-7", "pinball", (1, "KaMika"), (2, "Komdu"), simple_log((1, "KaMika"), (2, "Komdu"), []))
m._games["demo-session-7"]["watch"] = "demo-solo"
m._games["demo-session-7"]["audience"] = {1}
m._games["demo-session-7"]["live"] = {1: {"name": "KaMika", "payload": {"x": 0.55, "y": 0.62, "d": 0.03, "s": 36250}, "at": time.time() + 3600}}
demo("demo-session-6", "pinball", (1, "KaMika"), (2, "Komdu"), simple_log((1, "KaMika"), (2, "Komdu"), [(1, "start", {"players": [1, 2]})]))
m._games["demo-session-6"]["live"] = {1: {"name": "KaMika", "payload": {"x": 0.62, "y": 0.41, "d": 0.03, "s": 184500}, "at": time.time() + 3600},
                                      2: {"name": "Komdu", "payload": {"x": 0.30, "y": 0.77, "d": 0.03, "s": 96200}, "at": time.time() + 3600}}
demo("demo-session-4", "hearts", (1, "KaMika"), (2, "Komdu"), host_log((1, "KaMika"), (2, "Komdu"), hearts_view(["KaMika", "Komdu", "Pauline", "Michele"])))
demo("demo-session-5", "spades", (1, "KaMika"), (2, "Komdu"), host_log((1, "KaMika"), (2, "Komdu"), spades_view(["KaMika", "Komdu", "Pauline", "Michele"])))
demo("demo-session-1", "reversi", (1, "KaMika"), (2, "Komdu"), reversi_entries((1, "KaMika"), (2, "Komdu"), 22))
app = m.app
print("watch: /watch.html?id=demo-reversi")
