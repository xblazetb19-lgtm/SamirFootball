const express = require('express');
const http    = require('http');
const { Server } = require('socket.io');
const path    = require('path');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, { cors: { origin: '*' } });
const PORT   = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

// ── ÉTAT GLOBAL ──────────────────────────────────────────────────
const GW=1000, GH=580;
const BUT_R={x:0,   y:210, w:38, h:160};
const BUT_B={x:962, y:210, w:38, h:160};
const SPAWN_BALL={x:500,y:290};

const G = {
    players: {},
    ball: { x:500, y:290, vx:0, vy:0 },
    goalies: { rouge:290, bleu:290 },
    scores: { rouge:0, bleu:0 },
    timer: 300, timerMax: 300,
    started: false, goalLock: false
};

// ── PHYSIQUE BALLE SERVEUR ───────────────────────────────────────
const DRAG = 0.985;
const BOUNCE = 0.7;
const BS = 14; // rayon balle

function stepBall(dt) {
    const b = G.ball;

    // Déplacement
    b.x += b.vx * dt;
    b.y += b.vy * dt;

    // Drag
    b.vx *= Math.pow(DRAG, dt * 60);
    b.vy *= Math.pow(DRAG, dt * 60);

    // Stop si trop lent
    if (Math.abs(b.vx) < 1) b.vx = 0;
    if (Math.abs(b.vy) < 1) b.vy = 0;

    // Rebond murs haut/bas
    if (b.y - BS < 0)    { b.y = BS;      b.vy = Math.abs(b.vy) * BOUNCE; }
    if (b.y + BS > GH)   { b.y = GH - BS; b.vy = -Math.abs(b.vy) * BOUNCE; }

    // Rebond murs gauche (hors but) et droit (hors but)
    // Mur gauche au-dessus du but
    if (b.x - BS < 4 && b.y < BUT_R.y) { b.x = 4 + BS; b.vx = Math.abs(b.vx) * BOUNCE; }
    // Mur gauche en-dessous du but
    if (b.x - BS < 4 && b.y > BUT_R.y + BUT_R.h) { b.x = 4 + BS; b.vx = Math.abs(b.vx) * BOUNCE; }
    // Mur droit au-dessus du but
    if (b.x + BS > GW - 4 && b.y < BUT_B.y) { b.x = GW - 4 - BS; b.vx = -Math.abs(b.vx) * BOUNCE; }
    // Mur droit en-dessous du but
    if (b.x + BS > GW - 4 && b.y > BUT_B.y + BUT_B.h) { b.x = GW - 4 - BS; b.vx = -Math.abs(b.vx) * BOUNCE; }

    // Rebond gardien rouge (x=50)
    const gr = G.goalies.rouge;
    if (b.x - BS < 52 && b.x - BS > 38 && b.y > gr - 14 && b.y < gr + 14) {
        b.x = 52 + BS;
        const diff = (b.y - gr) / 14;
        const spd = Math.max(Math.sqrt(b.vx*b.vx + b.vy*b.vy), 300);
        const angle = diff * (Math.PI/3);
        b.vx = Math.abs(Math.cos(angle)) * spd;
        b.vy = Math.sin(angle) * spd;
    }

    // Rebond gardien bleu (x=950)
    const gb = G.goalies.bleu;
    if (b.x + BS > 948 && b.x + BS < 962 && b.y > gb - 14 && b.y < gb + 14) {
        b.x = 948 - BS;
        const diff = (b.y - gb) / 14;
        const spd = Math.max(Math.sqrt(b.vx*b.vx + b.vy*b.vy), 300);
        const angle = diff * (Math.PI/3);
        b.vx = -Math.abs(Math.cos(angle)) * spd;
        b.vy = Math.sin(angle) * spd;
    }

    // Détection but
    if (!G.goalLock) {
        const inButR = b.x - BS < 2 && b.y > BUT_R.y + BS && b.y < BUT_R.y + BUT_R.h - BS;
        const inButB = b.x + BS > GW - 2 && b.y > BUT_B.y + BS && b.y < BUT_B.y + BUT_B.h - BS;
        if (inButR) { scoreGoal('bleu', 'Serveur'); return; }
        if (inButB) { scoreGoal('rouge', 'Serveur'); return; }
    }
}

function scoreGoal(team, scorerPseudo) {
    if (G.goalLock) return;
    G.goalLock = true;
    if (team === 'rouge') G.scores.rouge++;
    else G.scores.bleu++;
    G.ball = { x:500, y:290, vx:0, vy:0 };
    io.emit('goal_scored', { team, scores: G.scores, scorerPseudo });
    setTimeout(() => {
        G.ball = { x:500, y:290, vx:0, vy:0 };
        G.goalies = { rouge:290, bleu:290 };
        io.emit('ball_reset', G.ball);
        G.goalLock = false;
    }, 2800);
}

// ── BOUCLE PHYSIQUE 60fps ────────────────────────────────────────
let lastTick = Date.now();
setInterval(() => {
    const now = Date.now();
    const dt = Math.min((now - lastTick) / 1000, 0.05);
    lastTick = now;
    if (Object.keys(G.players).length === 0) return;
    stepBall(dt);
    // Broadcast balle à tous les clients
    io.emit('ball_state', G.ball);
}, 16); // ~60fps

// ── SOCKET ───────────────────────────────────────────────────────
io.on('connection', socket => {
    console.log('+', socket.id);

    socket.on('join', ({ pseudo, team, poste, celeb, dribble, timerMax }) => {
        G.players[socket.id] = {
            id:socket.id, pseudo, team, poste, celeb, dribble,
            x: team==='rouge'?140:860, y:290, angle:0, hasBall:false
        };
        if (Object.keys(G.players).length===1 && timerMax) {
            G.timerMax = G.timer = timerMax;
        }
        if (Object.keys(G.players).length>=2 && !G.started) G.started=true;

        socket.broadcast.emit('player_joined', G.players[socket.id]);

        const snap = () => ({
            players: G.players, ball: G.ball,
            scores: G.scores, timer: G.timer, goalies: G.goalies
        });
        io.emit('full_state', snap());
        [300,800,1500].forEach(d=>setTimeout(()=>io.emit('full_state',snap()),d));
        socket.broadcast.emit('send_pos');
        console.log(`${pseudo} (${team}) — ${Object.keys(G.players).length} joueur(s)`);
    });

    socket.on('player_update', data => {
        const p = G.players[socket.id];
        if (!p) return;
        p.x=data.x; p.y=data.y; p.angle=data.angle; p.hasBall=data.hasBall;
        socket.broadcast.emit('player_move', {id:socket.id, ...data});
    });

    // Le client signale un contact avec la balle → serveur applique l'impulsion
    socket.on('ball_kick', ({ vx, vy }) => {
        G.ball.vx = vx;
        G.ball.vy = vy;
    });

    // Contact doux (joueur qui marche dans la balle)
    socket.on('ball_touch', ({ px, py }) => {
        if (G.goalLock) return;
        const dx = G.ball.x - px;
        const dy = G.ball.y - py;
        const dist = Math.sqrt(dx*dx+dy*dy);
        if (dist < 50 && dist > 0) {
            const a = Math.atan2(dy, dx);
            const impulse = 12;
            G.ball.vx += Math.cos(a) * impulse;
            G.ball.vy += Math.sin(a) * impulse;
        }
    });

    // Dribble : le client envoie la position exacte de la balle
    socket.on('ball_drib', ({ x, y }) => {
        G.ball.x = x;
        G.ball.y = y;
        G.ball.vx = 0;
        G.ball.vy = 0;
    });

    socket.on('goalie_move', ({ team, y }) => {
        G.goalies[team] = y;
        socket.broadcast.emit('goalie_move', { team, y });
    });

    socket.on('push', ({ targetId, dx, dy }) => {
        io.to(targetId).emit('got_pushed', { dx, dy, force:380 });
    });

    socket.on('chat_msg', ({ pseudo, msg, team }) => {
        io.emit('chat_msg', { pseudo, msg, team });
    });

    socket.on('disconnect', () => {
        const p = G.players[socket.id];
        if (!p) return;
        console.log('-', p.pseudo);
        io.emit('player_left', { id:socket.id, pseudo:p.pseudo });
        delete G.players[socket.id];
        if (Object.keys(G.players).length===0) {
            G.scores={rouge:0,bleu:0};
            G.ball={x:500,y:290,vx:0,vy:0};
            G.started=false; G.timer=G.timerMax;
        }
    });
});

// Timer
setInterval(() => {
    if (!G.started || Object.keys(G.players).length===0) return;
    if (G.timer > 0) {
        G.timer--;
        io.emit('timer_tick', G.timer);
        if (G.timer<=0) { G.started=false; io.emit('game_over',{scores:G.scores}); }
    }
}, 1000);

server.listen(PORT, () => console.log(`✅ http://localhost:${PORT}`));
