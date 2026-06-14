document.addEventListener('DOMContentLoaded', () => {
            const canvas = document.getElementById('gameCanvas');
            const ctx = canvas.getContext('2d');
            
            let canvasLogicalW = 1058.67;
            let canvasLogicalH = 808.667;
            let canvasDpr = 1;

            const mobileControls = document.getElementById('mobileControls');
            const touchStickBase = document.getElementById('touchStickBase');
            const touchStickKnob = document.getElementById('touchStickKnob');
            const touchFireBtn = document.getElementById('touchFireBtn');
            const touchMove = { active: false, x: 0, y: 0 };
            let touchFire = false;

            function updateMobileControlsVisibility() {
                if (!mobileControls) return;
                const inFight = canvas.style.display === 'block';
                const overlayEl = document.getElementById('messageOverlay');
                const dialogOpen = overlayEl && overlayEl.style.display === 'flex';
                const paused = typeof gamePaused !== 'undefined' && gamePaused;
                const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
                const narrow = window.innerWidth <= 900;
                const show = inFight && !dialogOpen && !paused && (coarsePointer || narrow);
                mobileControls.classList.toggle('visible', show);
                mobileControls.setAttribute('aria-hidden', show ? 'false' : 'true');
            }

            function bindMobileTouchControls() {
                if (!touchStickBase || !touchStickKnob || !touchFireBtn) return;
                const updateStick = (e) => {
                    const r = touchStickBase.getBoundingClientRect();
                    const cx = r.left + r.width / 2;
                    const cy = r.top + r.height / 2;
                    const max = r.width * 0.36;
                    let dx = e.clientX - cx;
                    let dy = e.clientY - cy;
                    const dist = Math.hypot(dx, dy);
                    if (dist > max && dist > 0) {
                        dx = (dx / dist) * max;
                        dy = (dy / dist) * max;
                    }
                    touchStickKnob.style.transform = `translate(${dx}px, ${dy}px)`;
                    const nx = max > 0 ? dx / max : 0;
                    const ny = max > 0 ? dy / max : 0;
                    touchMove.active = true;
                    touchMove.x = nx;
                    touchMove.y = ny;
                };
                const resetStick = () => {
                    touchMove.active = false;
                    touchMove.x = 0;
                    touchMove.y = 0;
                    touchStickKnob.style.transform = 'translate(0,0)';
                };
                touchStickBase.addEventListener('pointerdown', (e) => {
                    e.preventDefault();
                    touchStickBase.setPointerCapture(e.pointerId);
                    updateStick(e);
                });
                touchStickBase.addEventListener('pointermove', (e) => {
                    if (!touchStickBase.hasPointerCapture(e.pointerId)) return;
                    e.preventDefault();
                    updateStick(e);
                });
                touchStickBase.addEventListener('pointerup', (e) => {
                    if (touchStickBase.hasPointerCapture(e.pointerId)) {
                        touchStickBase.releasePointerCapture(e.pointerId);
                    }
                    resetStick();
                });
                touchStickBase.addEventListener('pointercancel', resetStick);
                touchStickBase.addEventListener('lostpointercapture', resetStick);

                const setFire = (v) => { touchFire = v; };
                touchFireBtn.addEventListener('pointerdown', (e) => {
                    e.preventDefault();
                    touchFireBtn.setPointerCapture(e.pointerId);
                    setFire(true);
                });
                touchFireBtn.addEventListener('pointerup', (e) => {
                    if (touchFireBtn.hasPointerCapture(e.pointerId)) {
                        touchFireBtn.releasePointerCapture(e.pointerId);
                    }
                    setFire(false);
                });
                touchFireBtn.addEventListener('pointercancel', () => setFire(false));
                touchFireBtn.addEventListener('lostpointercapture', () => setFire(false));
            }
            bindMobileTouchControls();

            // ── WEAPON EMOJI MAP ───────────────────────────────────────
            const weaponEmoji = { lightsaber:'⚔️', darksaber:'🖤', blaster:'🔫', zap:'⚡', staff:'🪄', bowcaster:'🏹', wrench:'🔧', lightning:'🌩️', computer:'💻' };
            const factionEmoji = { heroes:'🔵', villains:'🔴', secret:'🟣' };

            // ── DIFFICULTY ─────────────────────────────────────────────
            let currentDifficulty = 'normal';
            const diffSettings = {
                easy:   { aiSpread: 0.85, aiSpeed: 0.55, hpMult: 0.8,  alliesCount: 2 },
                normal: { aiSpread: 0.65, aiSpeed: 0.70, hpMult: 1.0,  alliesCount: 3 },
                hard:   { aiSpread: 0.25, aiSpeed: 0.90, hpMult: 1.25, alliesCount: 4 }
            };

            const cloneBackupArmy = {
                rex:    { unitId: '501st', name: '501st Legion Trooper' },
                cody:   { unitId: '212th', name: '212th Attack Battalion Trooper' },
                wolffe: { unitId: '104th', name: '104th Wolfpack Trooper' },
                bly:    { unitId: '327th', name: '327th Star Corps Trooper' },
                gree:   { unitId: '41st', name: '41st Elite Corps Trooper' },
                fox:    { unitId: 'coruscant', name: 'Coruscant Guard Trooper' },
                bacara: { unitId: '21st', name: '21st Nova Corps Marine' },
                neyo:   { unitId: '91st', name: '91st Mobile Recon Trooper' },
                appo:   { unitId: '501st', name: '501st Legion Trooper' },
                doom:   { unitId: '442nd', name: '442nd Siege Battalion Trooper' },
                ponds:  { unitId: '187th', name: '187th Battalion Trooper' },
                thorn:  { unitId: 'coruscant', name: 'Coruscant Guard Trooper' },
                ganch:  { unitId: '612th', name: '612th Attack Battalion Trooper' },
                colt:   { unitId: 'rancor', name: 'Rancor Battalion ARC Trooper' },
                crane:  { unitId: '184th', name: '184th Attack Battalion Trooper' }
            };
            const cloneBackupLeaders = new Set(Object.keys(cloneBackupArmy));

            // ── STARFIELD ──────────────────────────────────────────────
            const starLayers = [
                { stars: [], speed: 0.15, size: 0.8, count: 60,  alpha: 0.4 },
                { stars: [], speed: 0.35, size: 1.4, count: 40,  alpha: 0.65 },
                { stars: [], speed: 0.65, size: 2.0, count: 20,  alpha: 0.9 }
            ];
            function initStars() {
                starLayers.forEach(layer => {
                    layer.stars = [];
                    for (let i = 0; i < layer.count; i++) {
                        layer.stars.push({ x: Math.random() * canvasLogicalW, y: Math.random() * canvasLogicalH, twinkle: Math.random() * Math.PI * 2 });
                    }
                });
            }
            initStars();

            // ── GAME STATS ─────────────────────────────────────────────
            let killCount = 0;
            let gameStartTime = 0;
            let countdownActive = false;
            let playerDamageDealt = 0;
            let playerShotsFired = 0;
            let playerHitsLanded = 0;
            /** Round clock counts down with game simulation time (same rAF as gameplay), not wall-clock setInterval — avoids “frozen canvas, running timer” when the tab is throttled or the main thread stalls. */
            let roundTimeRemaining = 180;
            const ROUND_SECONDS = 180;

            // ── SERIES / ROUND TRACKING ────────────────────────────────
            let playerWins = 0;
            let enemyWins = 0;
            const SERIES_WINS_NEEDED = 3; // best of 5
            let isNextRound = false;
            let seriesPlayerCharId = null;
            let seriesEnemyCharId = null;
            /** True if the current series opponent was chosen via Surprise Me (not manual roster pick). */
            let seriesEnemyFromRandom = false;

            // ── ARENA DEFINITIONS ──────────────────────────────────────
            const ARENAS = {
                space: {
                    bg: (w, h, _tickScale) => {
                        const grad = ctx.createRadialGradient(w/2, h/2, 0, w/2, h/2, Math.max(w,h)*0.7);
                        grad.addColorStop(0, '#111827'); grad.addColorStop(1, '#030712');
                        ctx.fillStyle = grad; ctx.fillRect(0,0,w,h);
                    },
                    grid: 'rgba(255,255,255,0.025)',
                    coverColor: '#334455', coverBorder: '#4a6a8a'
                },
                deathstar: {
                    bg: (w, h, _tickScale) => {
                        ctx.fillStyle = '#0d0d0d'; ctx.fillRect(0,0,w,h);
                        // Trench lines
                        ctx.strokeStyle = 'rgba(80,80,80,0.18)'; ctx.lineWidth = 1;
                        for (let i = 0; i < w; i += 60) { ctx.beginPath(); ctx.moveTo(i,0); ctx.lineTo(i,h); ctx.stroke(); }
                        for (let i = 0; i < h; i += 60) { ctx.beginPath(); ctx.moveTo(0,i); ctx.lineTo(w,i); ctx.stroke(); }
                        // Superlaser glow
                        const g = ctx.createRadialGradient(w*0.15, h*0.5, 5, w*0.15, h*0.5, 80);
                        g.addColorStop(0,'rgba(0,200,80,0.12)'); g.addColorStop(1,'rgba(0,0,0,0)');
                        ctx.fillStyle = g; ctx.fillRect(0,0,w,h);
                    },
                    grid: 'rgba(0,200,80,0.04)',
                    coverColor: '#2a2a2a', coverBorder: '#555'
                },
                mustafar: {
                    bg: (w, h, _tickScale) => {
                        ctx.fillStyle = '#1a0a00'; ctx.fillRect(0,0,w,h);
                    },
                    grid: 'rgba(255,80,0,0.04)',
                    coverColor: '#3a1a00', coverBorder: '#7a3300'
                },
                hoth: {
                    bg: (w, h, tickScale = 1) => {
                        const g = ctx.createLinearGradient(0,0,0,h);
                        g.addColorStop(0,'#c8e4f4'); g.addColorStop(1,'#e8f4fc');
                        ctx.fillStyle = g; ctx.fillRect(0,0,w,h);
                        // Snow drift at bottom
                        const drift = ctx.createLinearGradient(0,h*0.8,0,h);
                        drift.addColorStop(0,'rgba(255,255,255,0)'); drift.addColorStop(1,'rgba(255,255,255,0.35)');
                        ctx.fillStyle = drift; ctx.fillRect(0,0,w,h);
                        // Blizzard particles (static snowflakes)
                        if (!ARENAS.hoth._snow) {
                            ARENAS.hoth._snow = Array.from({length:60},()=>({x:Math.random()*canvasLogicalW,y:Math.random()*canvasLogicalH,r:Math.random()*2+0.5}));
                        }
                        ARENAS.hoth._snow.forEach(s => {
                            s.x = (s.x - 0.6 * tickScale + w) % w;
                            ctx.fillStyle='rgba(255,255,255,0.55)';
                            ctx.beginPath(); ctx.arc(s.x,s.y,s.r,0,Math.PI*2); ctx.fill();
                        });
                    },
                    grid: 'rgba(100,160,220,0.07)',
                    coverColor: '#c0d8ee', coverBorder: '#7ab0d0'
                },
                coruscant: {
                    bg: (w, h, _tickScale) => {
                        ctx.fillStyle = '#05080f'; ctx.fillRect(0,0,w,h);
                        // City light windows
                        if (!ARENAS.coruscant._windows) {
                            ARENAS.coruscant._windows = Array.from({length:120},()=>({
                                x:Math.random()*canvasLogicalW, y:Math.random()*canvasLogicalH,
                                w:Math.random()*6+2, h:Math.random()*4+1,
                                color:`hsl(${Math.random()*60+30},80%,${Math.random()*30+50}%)`,
                                blink: Math.random()*5
                            }));
                        }
                        const t = Date.now()*0.001;
                        ARENAS.coruscant._windows.forEach(win => {
                            const alpha = 0.4 + 0.35 * Math.sin(t * win.blink);
                            ctx.globalAlpha = alpha;
                            ctx.fillStyle = win.color;
                            ctx.fillRect(win.x, win.y, win.w, win.h);
                        });
                        ctx.globalAlpha = 1;
                        // Speeder lane glow streaks
                        const laneY = [h*0.3, h*0.6];
                        laneY.forEach(ly => {
                            const gLane = ctx.createLinearGradient(0,ly-6,0,ly+6);
                            gLane.addColorStop(0,'rgba(255,220,80,0)'); gLane.addColorStop(0.5,'rgba(255,220,80,0.06)'); gLane.addColorStop(1,'rgba(255,220,80,0)');
                            ctx.fillStyle = gLane; ctx.fillRect(0,ly-6,w,12);
                        });
                    },
                    grid: 'rgba(255,200,50,0.04)',
                    coverColor: '#1a1a2e', coverBorder: '#3a3a5e'
                },
                moseisley: {
                    bg: (w, h, _tickScale) => {
                        // Cantina interior - warm tan/brown tones
                        const g = ctx.createLinearGradient(0,0,0,h);
                        g.addColorStop(0,'#3d2b1f'); g.addColorStop(1,'#2a1d15');
                        ctx.fillStyle = g; ctx.fillRect(0,0,w,h);
                        
                        // Ambient warm light from center
                        const center = ctx.createRadialGradient(w/2, h/2, 0, w/2, h/2, Math.max(w,h)*0.6);
                        center.addColorStop(0,'rgba(255,200,100,0.08)'); center.addColorStop(1,'rgba(0,0,0,0)');
                        ctx.fillStyle = center; ctx.fillRect(0,0,w,h);
                        
                        // Subtle wall texture
                        ctx.strokeStyle = 'rgba(180,140,80,0.03)';
                        ctx.lineWidth = 1;
                        for (let i = 0; i < w; i += 40) { ctx.beginPath(); ctx.moveTo(i,0); ctx.lineTo(i,h); ctx.stroke(); }
                        for (let i = 0; i < h; i += 40) { ctx.beginPath(); ctx.moveTo(0,i); ctx.lineTo(w,i); ctx.stroke(); }
                    },
                    grid: 'rgba(255,200,100,0.03)',
                    coverColor: '#5a4030', coverBorder: '#8a6a50'
                },
                naboo: {
                    bg: (w, h, _tickScale) => {
                        // Theed Palace reactor core — deep purples and gold
                        const g = ctx.createLinearGradient(0, 0, 0, h);
                        g.addColorStop(0, '#1a0a2e');
                        g.addColorStop(0.5, '#2d1b4e');
                        g.addColorStop(1, '#0e0618');
                        ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);

                        // Central reactor glow
                        const reactor = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, h * 0.4);
                        reactor.addColorStop(0, 'rgba(180, 100, 255, 0.18)');
                        reactor.addColorStop(0.5, 'rgba(100, 40, 180, 0.08)');
                        reactor.addColorStop(1, 'rgba(0, 0, 0, 0)');
                        ctx.fillStyle = reactor; ctx.fillRect(0, 0, w, h);

                        // Gold trim pillars on edges
                        ctx.strokeStyle = 'rgba(200, 170, 80, 0.12)';
                        ctx.lineWidth = 2;
                        for (let i = 0; i < w; i += 80) {
                            ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, h); ctx.stroke();
                        }
                        // Horizontal energy ring lines
                        const t = Date.now() * 0.001;
                        for (let ring = 0; ring < 3; ring++) {
                            const ry = h * 0.2 + ring * h * 0.3 + Math.sin(t * 0.5 + ring) * 8;
                            ctx.strokeStyle = `rgba(160, 80, 255, ${0.06 + ring * 0.02})`;
                            ctx.lineWidth = 1;
                            ctx.beginPath(); ctx.moveTo(0, ry); ctx.lineTo(w, ry); ctx.stroke();
                        }
                        // Plasma energy pulses rising from bottom
                        if (!ARENAS.naboo._pulses) {
                            ARENAS.naboo._pulses = Array.from({ length: 8 }, (_, i) => ({
                                x: (i / 8) * w + 30,
                                y: Math.random() * h,
                                speed: Math.random() * 0.4 + 0.2,
                                alpha: Math.random() * 0.3 + 0.05
                            }));
                        }
                        ARENAS.naboo._pulses.forEach(p => {
                            p.y -= p.speed;
                            if (p.y < -10) p.y = h + 10;
                            ctx.fillStyle = `rgba(180, 100, 255, ${p.alpha})`;
                            ctx.beginPath(); ctx.arc(p.x, p.y, 2, 0, Math.PI * 2); ctx.fill();
                        });
                    },
                    grid: 'rgba(180, 100, 255, 0.04)',
                    coverColor: '#2d1040', coverBorder: '#7b4fa0'
                },
                tatooine: {
                    bg: (w, h, _tickScale) => {
                        // Desert landscape - sandy orange tones
                        const g = ctx.createLinearGradient(0,0,0,h);
                        g.addColorStop(0,'#c9a066'); g.addColorStop(0.6,'#d4a574'); g.addColorStop(1,'#e8c898');
                        ctx.fillStyle = g; ctx.fillRect(0,0,w,h);
                        
                        // Twin suns glow
                        const suns = ctx.createRadialGradient(w*0.7, h*0.15, 0, w*0.7, h*0.15, 120);
                        suns.addColorStop(0,'rgba(255,200,100,0.25)'); suns.addColorStop(0.5,'rgba(255,180,80,0.1)'); suns.addColorStop(1,'rgba(0,0,0,0)');
                        ctx.fillStyle = suns; ctx.fillRect(0,0,w,h);
                        
                        // Dunes at bottom
                        const dunes = ctx.createLinearGradient(0,h*0.75,0,h);
                        dunes.addColorStop(0,'rgba(180,130,80,0)'); dunes.addColorStop(1,'rgba(160,110,60,0.2)');
                        ctx.fillStyle = dunes; ctx.fillRect(0,0,w,h);
                        
                        // Heat shimmer effect
                        ctx.strokeStyle = 'rgba(255,220,150,0.02)';
                        ctx.lineWidth = 2;
                        for (let i = 0; i < w; i += 50) { ctx.beginPath(); ctx.moveTo(i, h*0.3); ctx.lineTo(i + Math.sin(Date.now()*0.002)*10, h*0.5); ctx.stroke(); }
                    },
                    grid: 'rgba(180,130,80,0.05)',
                    coverColor: '#a67c4a', coverBorder: '#c9a066'
                }
            };

            // ── DESTRUCTIBLE COVER ─────────────────────────────────────
            let coverObjects = [];

            // Arena-specific layout configs: each entry is { x (0-1), y (0-1), w, h, shape }
            // shape: 'rect' | 'L' | 'T' — affects how the cover is drawn
            const ARENA_LAYOUTS = {
                // Space: Scattered asteroid debris — diamond cluster
                space: [
                    { x:0.20, y:0.25, w:55, h:20 }, { x:0.80, y:0.25, w:55, h:20 },
                    { x:0.50, y:0.20, w:20, h:55 },
                    { x:0.30, y:0.55, w:20, h:55 }, { x:0.70, y:0.55, w:20, h:55 },
                    { x:0.50, y:0.75, w:70, h:18 }
                ],
                // Death Star: Trench corridors — two long side walls + a center blockade
                deathstar: [
                    { x:0.15, y:0.25, w:18, h:120 }, { x:0.85, y:0.25, w:18, h:120 },
                    { x:0.15, y:0.75, w:18, h:100 }, { x:0.85, y:0.75, w:18, h:100 },
                    { x:0.50, y:0.35, w:90, h:18 },
                    { x:0.50, y:0.65, w:90, h:18 }
                ],
                // Mustafar: Lava crossing — three bridge segments
                mustafar: [
                    { x:0.25, y:0.40, w:80, h:18 }, { x:0.75, y:0.60, w:80, h:18 },
                    { x:0.50, y:0.50, w:18, h:70 },
                    { x:0.20, y:0.70, w:18, h:50 }, { x:0.80, y:0.30, w:18, h:50 }
                ],
                // Hoth: Bunker fortifications — asymmetric trenches on both sides
                hoth: [
                    { x:0.22, y:0.30, w:100, h:18 }, { x:0.22, y:0.55, w:18, h:80 },
                    { x:0.78, y:0.70, w:100, h:18 }, { x:0.78, y:0.45, w:18, h:80 },
                    { x:0.50, y:0.50, w:55, h:18 }
                ],
                // Coruscant: City blocks — staggered urban cover
                coruscant: [
                    { x:0.20, y:0.35, w:22, h:60 }, { x:0.80, y:0.65, w:22, h:60 },
                    { x:0.40, y:0.25, w:60, h:18 }, { x:0.60, y:0.75, w:60, h:18 },
                    { x:0.40, y:0.55, w:18, h:45 }, { x:0.60, y:0.45, w:18, h:45 }
                ],
                // Mos Eisley: Cantina interior — round pillars and bar counter
                moseisley: [
                    { x:0.25, y:0.30, w:24, h:24 }, { x:0.50, y:0.25, w:24, h:24 },
                    { x:0.75, y:0.30, w:24, h:24 },
                    { x:0.25, y:0.70, w:24, h:24 }, { x:0.75, y:0.70, w:24, h:24 },
                    { x:0.50, y:0.50, w:18, h:80 }
                ],
                // Tatooine: Desert dunes — scattered natural cover
                tatooine: [
                    { x:0.18, y:0.40, w:65, h:18 }, { x:0.82, y:0.60, w:65, h:18 },
                    { x:0.35, y:0.65, w:18, h:50 }, { x:0.65, y:0.35, w:18, h:50 },
                    { x:0.50, y:0.50, w:50, h:18 }
                ],
                // Naboo: Reactor core — radial catwalks
                naboo: [
                    { x:0.35, y:0.30, w:18, h:55 }, { x:0.65, y:0.30, w:18, h:55 },
                    { x:0.35, y:0.70, w:18, h:55 }, { x:0.65, y:0.70, w:18, h:55 },
                    { x:0.50, y:0.50, w:60, h:18 }
                ]
            };

            function spawnCover() {
                coverObjects = [];
                const w = canvasLogicalW, h = canvasLogicalH;
                const layout = ARENA_LAYOUTS[currentArena] || ARENA_LAYOUTS.space;
                layout.forEach(pos => {
                    coverObjects.push({
                        x: pos.x * w, y: pos.y * h,
                        w: pos.w, h: pos.h,
                        hp: 80, maxHp: 80, alive: true,
                        hitFlash: 0,
                        shape: pos.shape || 'rect'
                    });
                });
            }

            function drawCovers() {
                const arenaStyle = ARENAS[currentArena] || ARENAS.space;
                const isHoth = currentArena === 'hoth';
                const isMustafar = currentArena === 'mustafar';
                const isDeathStar = currentArena === 'deathstar';
                const isCantina = currentArena === 'moseisley';
                const isNaboo = currentArena === 'naboo';
                const isCoruscant = currentArena === 'coruscant';
                const isTatooine = currentArena === 'tatooine';
                
                // Cache time for animations to avoid repeated Date.now() calls
                const animTime = Date.now();

                coverObjects.forEach(c => {
                    if (!c.alive) return;
                    const pct = c.hp / c.maxHp;
                    ctx.save();
                    const flashAlpha = animTime < c.hitFlash ? 0.75 : 1;
                    ctx.globalAlpha = flashAlpha;

                    // Arena-specific styling
                    let fillStyle = arenaStyle.coverColor;
                    let strokeStyle = arenaStyle.coverBorder;
                    let cornerR = 3;
                    let linePattern = null;

                    if (isHoth) {
                        // Ice/snow bunker — light blue with frost
                        fillStyle = `rgba(180, 210, 235, ${0.82 * pct + 0.18})`;
                        strokeStyle = '#7ab0d0';
                        cornerR = 2;
                    } else if (isMustafar) {
                        // Molten rock platforms — dark orange/brown
                        const heat = 0.5 + 0.5 * Math.sin(animTime * 0.003 + c.x * 0.01);
                        fillStyle = `rgb(${Math.round(60 + heat*30)}, ${Math.round(25 + heat*10)}, 5)`;
                        strokeStyle = `rgba(255, ${Math.round(80 + heat*80)}, 0, 0.8)`;
                        cornerR = 1;
                    } else if (isDeathStar) {
                        // Metal grid panels
                        fillStyle = '#222';
                        strokeStyle = '#555';
                        linePattern = [8, 4];
                        cornerR = 0;
                    } else if (isCantina) {
                        // Round tables/pillars — warm tan
                        fillStyle = '#5a3a28';
                        strokeStyle = '#9a6a50';
                        cornerR = c.w === c.h ? c.w/2 : 5; // circular for square shapes
                    } else if (isNaboo) {
                        // Plasma-lit walkways — purple tint
                        const pulse = 0.5 + 0.5 * Math.sin(animTime * 0.002 + c.x * 0.01);
                        fillStyle = `rgba(45, 18, 68, 0.9)`;
                        strokeStyle = `rgba(${Math.round(140 + pulse*60)}, ${Math.round(60 + pulse*20)}, 255, 0.9)`;
                        cornerR = 4;
                    } else if (isCoruscant) {
                        // City building facades
                        fillStyle = '#1a1a2e';
                        strokeStyle = '#4a4a7e';
                        linePattern = [12, 6];
                        cornerR = 2;
                    } else if (isTatooine) {
                        // Sandy dunes — rounded, warm
                        fillStyle = '#a67c4a';
                        strokeStyle = '#c9a066';
                        cornerR = 6;
                    }

                    // Crack effect at low HP
                    if (pct < 0.4) {
                        ctx.setLineDash([3, 4]);
                    }
                    if (linePattern && pct >= 0.4) {
                        ctx.setLineDash(linePattern);
                    }

                    // Removed shadowBlur for performance

                    // Draw cover body
                    if (isDeathStar) {
                        // Flat rectangle for Death Star trench walls
                        ctx.fillStyle = fillStyle;
                        ctx.strokeStyle = strokeStyle;
                        ctx.lineWidth = 2;
                        ctx.fillRect(c.x - c.w/2, c.y - c.h/2, c.w, c.h);
                        ctx.strokeRect(c.x - c.w/2, c.y - c.h/2, c.w, c.h);
                        // Panel rivets
                        ctx.setLineDash([]);
                        ctx.fillStyle = '#444';
                        const rows = Math.max(1, Math.floor(c.h / 20));
                        const cols = Math.max(1, Math.floor(c.w / 20));
                        for (let rr = 0; rr < rows; rr++) {
                            for (let cc = 0; cc < cols; cc++) {
                                ctx.beginPath();
                                ctx.arc(c.x - c.w/2 + 10 + cc * 20, c.y - c.h/2 + 10 + rr * 20, 2, 0, Math.PI*2);
                                ctx.fill();
                            }
                        }
                    } else if (isCantina && c.w === c.h) {
                        // Circular pillar/table
                        ctx.fillStyle = fillStyle;
                        ctx.strokeStyle = strokeStyle;
                        ctx.lineWidth = 2;
                        ctx.beginPath();
                        ctx.arc(c.x, c.y, c.w/2, 0, Math.PI*2);
                        ctx.fill(); ctx.stroke();
                        // Table top ring
                        ctx.strokeStyle = '#c89a70';
                        ctx.lineWidth = 1;
                        ctx.beginPath();
                        ctx.arc(c.x, c.y, c.w/2 - 4, 0, Math.PI*2);
                        ctx.stroke();
                    } else {
                        ctx.fillStyle = fillStyle;
                        ctx.strokeStyle = strokeStyle;
                        ctx.lineWidth = 2;
                        ctx.beginPath();
                        ctx.roundRect(c.x - c.w/2, c.y - c.h/2, c.w, c.h, cornerR);
                        ctx.fill(); ctx.stroke();

                        // Arena-specific details
                        if (isHoth && pct >= 0.4) {
                            // Ice crystal lines
                            ctx.setLineDash([]);
                            ctx.strokeStyle = 'rgba(200,230,255,0.35)';
                            ctx.lineWidth = 1;
                            ctx.beginPath();
                            ctx.moveTo(c.x - c.w/2 + 4, c.y - c.h/2 + 4);
                            ctx.lineTo(c.x + c.w/4, c.y + c.h/4);
                            ctx.stroke();
                        }
                        if (isCoruscant && pct >= 0.4) {
                            // Window lights
                            ctx.setLineDash([]);
                            const wLit = Math.floor(c.w / 8);
                            for (let wi = 0; wi < wLit; wi++) {
                                ctx.fillStyle = `rgba(255,220,80,${0.3 + Math.sin(Date.now()*0.002 + wi)*0.15})`;
                                ctx.fillRect(c.x - c.w/2 + 4 + wi * 7, c.y - c.h/2 + 4, 4, 3);
                            }
                        }
                    }

                    ctx.setLineDash([]);

                    // HP bar
                    const barY = c.y - c.h/2 - 8;
                    ctx.shadowBlur = 0;
                    ctx.fillStyle = 'rgba(0,0,0,0.5)';
                    ctx.fillRect(c.x - c.w/2, barY, c.w, 4);
                    const hpColor = pct > 0.5 ? '#00cc55' : pct > 0.25 ? '#ffaa00' : '#ff3333';
                    ctx.fillStyle = hpColor;
                    ctx.fillRect(c.x - c.w/2, barY, c.w * pct, 4);

                    ctx.restore();
                });
            }

            function checkBulletCoverCollision(bullet) {
                if (bullet.returnable && bullet.returning) return false;
                for (const c of coverObjects) {
                    if (!c.alive) continue;
                    const hw = c.w/2 + 4, hh = c.h/2 + 4;
                    if (bullet.x > c.x-hw && bullet.x < c.x+hw && bullet.y > c.y-hh && bullet.y < c.y+hh) {
                        c.hp -= bullet.damage * 0.6;
                        c.hitFlash = Date.now() + 80;
                        spawnImpactParticles(bullet.x, bullet.y, bullet.color, 5);
                        if (c.hp <= 0) {
                            c.alive = false;
                            triggerScreenShake(5, 10);
                            for (let k = 0; k < 12; k++) {
                                const a = Math.random()*Math.PI*2, sp = Math.random()*3+1;
                                if (deathParticles.length < MAX_DEATH_PARTICLES) deathParticles.push({x:c.x,y:c.y,dx:Math.cos(a)*sp,dy:Math.sin(a)*sp,life:28,maxLife:28,color:'#888',r:Math.random()*3+1});
                            }
                        }
                        return true;
                    }
                }
                return false;
            }

            function checkEntityCoverCollision(e, tickScale) {
                for (const c of coverObjects) {
                    if (!c.alive) continue;
                    const hw = c.w/2 + CHARACTER_SIZE, hh = c.h/2 + CHARACTER_SIZE;
                    if (e.x > c.x-hw && e.x < c.x+hw && e.y > c.y-hh && e.y < c.y+hh) {
                        // Push entity out of cover
                        const overlapX = (e.x > c.x) ? (c.x+hw - e.x) : -(e.x - (c.x-hw));
                        const overlapY = (e.y > c.y) ? (c.y+hh - e.y) : -(e.y - (c.y-hh));
                        if (Math.abs(overlapX) < Math.abs(overlapY)) e.x += overlapX * 0.4;
                        else e.y += overlapY * 0.4;
                        const damp = Math.pow(0.2, tickScale);
                        e.vx *= damp; e.vy *= damp;
                    }
                }
            }

            // ── ACHIEVEMENT UNLOCKABLES ────────────────────────────────
            const achievements = {
                droidSlayer:   { id:'droidSlayer',   label:'Droid Slayer',      desc:'Win a battle against a Droid',           unlocks:'droidslayer_vader',  done: false },
                hothSurvivor:  { id:'hothSurvivor',  label:'Hoth Survivor',     desc:'Win on the Hoth arena',                  unlocks:'hoth_echo_base',     done: false },
                saberMaster:   { id:'saberMaster',   label:'Saber Master',       desc:'Win 3 battles with a lightsaber user',   unlocks:'saber_master_kit',   done: false },
                noHits:        { id:'noHits',        label:'Untouchable',        desc:'Win a round without taking damage',       unlocks:'untouchable_suit',   done: false },
                highGround:    { id:'highGround',    label:'I have the high ground!', desc:'Win on Mustafar as Obi-Wan when Surprise Me rolls Anakin', unlocks:'burnt_anakin', done: false },
                // New achievements
                winStreak3:     { id:'winStreak3',     label:'Hot Streak',        desc:'Win 3 matches in a row',                unlocks:'hot_streak',         done: false },
                winStreak5:     { id:'winStreak5',     label:'On Fire',           desc:'Win 5 matches in a row',                unlocks:'on_fire',            done: false },
                winStreak10:    { id:'winStreak10',    label:'Unstoppable',       desc:'Win 10 matches in a row',               unlocks:'unstoppable',        done: false },
                perfectVictory: { id:'perfectVictory', label:'Perfect Victory',   desc:'Win without taking any damage',         unlocks:'perfect_victory',    done: false },
                tatooineUnlock: { id:'tatooineUnlock', label:'Tatooine Unlocked', desc:'Defeat Anakin as Boba Fett in Mos Eisley', unlocks:'tatooine_arena', done: false },
                jabbaUnlock:    { id:'jabbaUnlock',    label:'Jabba Unleashed',   desc:'Defeat Jabba after freeing Carbonite Han on Tatooine', unlocks:'jabba_hutt', done: false },
                speedDemon:     { id:'speedDemon',     label:'Speed Demon',       desc:'Win a match in under 30 seconds',       unlocks:'speed_demon',        done: false },
                comboMaster:    { id:'comboMaster',    label:'Combo Master',      desc:'Kill 3 enemies within 5 seconds',        unlocks:'combo_master',       done: false },
                // Mastery achievements
                blasterMaster:  { id:'blasterMaster',  label:'Blaster Master',    desc:'Win 5 matches with a blaster',          unlocks:'blaster_master',     done: false },
                saberMaster2:   { id:'saberMaster2',   label:'Saber Master II',   desc:'Win 5 matches with a lightsaber',       unlocks:'saber_master_ii',    done: false },
                // Arena specialist
                spaceSpecialist:{ id:'spaceSpecialist',label:'Space Specialist',  desc:'Win 5 matches in Deep Space',            unlocks:'space_specialist',   done: false },
                // New: milestone & exploration achievements
                firstWin:       { id:'firstWin',       label:'First Blood',       desc:'Win your very first battle',            unlocks:'first_blood',        done: false },
                arenaExplorer:  { id:'arenaExplorer',  label:'Arena Explorer',    desc:'Win in 5 different arenas',             unlocks:'arena_explorer',     done: false },
                villainSlayer:  { id:'villainSlayer',  label:'Villain Slayer',    desc:'Defeat 5 different villain characters', unlocks:'villain_slayer',     done: false },
                vaderSlayer:    { id:'vaderSlayer',    label:'I Am Your Father',  desc:'Defeat Darth Vader',                   unlocks:'vader_slayer',       done: false },
                bountyHunter:   { id:'bountyHunter',   label:'Bounty Hunter',     desc:'Win a match as a bounty hunter',        unlocks:'bounty_hunter',      done: false },
                millenniumRun:  { id:'millenniumRun',  label:'Kessel Run',        desc:'Win 3 matches as Han Solo',             unlocks:'kessel_run',         done: false },
                // Vader mastery
                vaderConquest:  { id:'vaderConquest',  label:'Dark Lord\'s Reign',desc:'Win 10 consecutive matches as Darth Vader', unlocks:'elite_vader',      done: false },
            };

            let gameUnlocks = { secretFaction: false, burntAnakin: false, tatooineArena: false, senatorPalpatine: false, jabbaUnlock: false, devTeam: false, tarffulUnlock: false };

            function persistGalacticUnlocks() {
                try { localStorage.setItem('galacticDuelUnlocks', JSON.stringify(gameUnlocks)); } catch(e) {}
            }

            function updateSecretFactionSectionVisibility() {
                const el = document.getElementById('secret-faction-wrapper');
                if (!el) return;
                el.style.display = (gameUnlocks.secretFaction || gameUnlocks.burntAnakin || gameUnlocks.senatorPalpatine || gameUnlocks.devTeam || gameUnlocks.tarffulUnlock) ? 'flex' : 'none';
            }

            function loadGalacticUnlocks() {
                try {
                    const u = JSON.parse(localStorage.getItem('galacticDuelUnlocks') || '{}');
                    gameUnlocks.secretFaction = !!u.secretFaction;
                    gameUnlocks.burntAnakin = !!u.burntAnakin;
                    gameUnlocks.tatooineArena = !!u.tatooineArena;
                    gameUnlocks.senatorPalpatine = !!u.senatorPalpatine;
                    gameUnlocks.jabbaUnlock = !!u.jabbaUnlock;
                    gameUnlocks.devTeam = !!u.devTeam;
                    gameUnlocks.tarffulUnlock = !!u.tarffulUnlock;
                } catch(e) {}
                updateSecretFactionSectionVisibility();
                // Show Tatooine arena button if unlocked
                if (gameUnlocks.tatooineArena) {
                    const btn = document.getElementById('tatooineArenaBtn');
                    if (btn) btn.style.display = 'inline-block';
                }
            }
            let saberWinCount = 0;
            let playerTookDamage = false;
            let comboKills = [];
            let lastKillTime = 0;
            let blasterWinCount = 0;
            let saberWinCount2 = 0;
            let spaceWinCount = 0;
            let totalWins = 0;
            let hanWinCount = 0;
            let arenasWonIn = new Set();
            let villainsDefeated = new Set();
            let vaderConsecutiveWins = 0;
            let lastPlayedCharacterId = null;
            const BOUNTY_HUNTER_IDS = new Set(['boba','jango','jango_fett','cadbane','bossk','dengar','ig88','aurrasing','embo','bobafett']);

            function tryUnlockAchievement(id) {
                const a = achievements[id];
                if (!a || a.done) return;
                a.done = true;
                try {
                    const saved = JSON.parse(localStorage.getItem('galacticDuelAchievements') || '{}');
                    saved[id] = true;
                    // Always persist progress counters so they survive refreshes
                    saved._saberWinCount   = saberWinCount;
                    saved._saberWinCount2  = saberWinCount2;
                    saved._blasterWinCount = blasterWinCount;
                    saved._spaceWinCount   = spaceWinCount;
                    saved._totalWins       = totalWins;
                    saved._hanWinCount     = hanWinCount;
                    saved._arenasWonIn     = [...arenasWonIn];
                    saved._villainsDefeated= [...villainsDefeated];
                    localStorage.setItem('galacticDuelAchievements', JSON.stringify(saved));
                } catch(e) {}
                showAchievementToast(a);
                rebuildSecretRoster();
                rebuildHeroRoster();
                rebuildVillainRoster();
            }

            function persistAchievementCounters() {
                try {
                    const saved = JSON.parse(localStorage.getItem('galacticDuelAchievements') || '{}');
                    saved._saberWinCount   = saberWinCount;
                    saved._saberWinCount2  = saberWinCount2;
                    saved._blasterWinCount = blasterWinCount;
                    saved._spaceWinCount   = spaceWinCount;
                    saved._totalWins       = totalWins;
                    saved._hanWinCount     = hanWinCount;
                    saved._arenasWonIn     = [...arenasWonIn];
                    saved._villainsDefeated= [...villainsDefeated];
                    saved._vaderConsecutiveWins = vaderConsecutiveWins;
                    saved._lastPlayedCharacterId = lastPlayedCharacterId;
                    localStorage.setItem('galacticDuelAchievements', JSON.stringify(saved));
                } catch(e) {}
            }

            function loadAchievements() {
                try {
                    const saved = JSON.parse(localStorage.getItem('galacticDuelAchievements') || '{}');
                    Object.keys(saved).forEach(id => { if (achievements[id]) achievements[id].done = true; });
                    // Restore persistent progress counters
                    saberWinCount  = saved._saberWinCount  || 0;
                    saberWinCount2 = saved._saberWinCount2 || 0;
                    blasterWinCount= saved._blasterWinCount|| 0;
                    spaceWinCount  = saved._spaceWinCount  || 0;
                    totalWins      = saved._totalWins      || 0;
                    hanWinCount    = saved._hanWinCount    || 0;
                    arenasWonIn    = new Set(saved._arenasWonIn || []);
                    villainsDefeated = new Set(saved._villainsDefeated || []);
                    vaderConsecutiveWins = saved._vaderConsecutiveWins || 0;
                    lastPlayedCharacterId = saved._lastPlayedCharacterId || null;
                } catch(e) {}
            }
            loadAchievements();

            function showAchievementToast(a) {
                let toast = document.getElementById('achievementToast');
                if (!toast) {
                    toast = document.createElement('div');
                    toast.id = 'achievementToast';
                    toast.style.cssText = `position:absolute;bottom:100px;left:50%;transform:translateX(-50%);
                        background:rgba(0,0,0,0.88);border:1px solid #ffd700;border-radius:10px;
                        padding:12px 22px;z-index:30;font-family:'Orbitron',sans-serif;text-align:center;
                        pointer-events:none;animation:streakPop 0.3s ease-out;`;
                    document.querySelector('.game-container').appendChild(toast);
                }
                toast.innerHTML = `<div style="font-size:0.65rem;color:#ffd700;letter-spacing:2px;margin-bottom:4px;">🏆 ACHIEVEMENT UNLOCKED</div>
                    <div style="font-size:0.85rem;color:#fff;">${a.label}</div>
                    <div style="font-size:0.6rem;color:rgba(255,255,255,0.5);margin-top:3px;">${a.desc}</div>`;
                toast.style.display = 'block';
                setTimeout(() => { if (toast) toast.style.display = 'none'; }, 4000);
            }

            function showAnnouncement(msg, color = '#00cfff', duration = 4500, title = '⚡ TRANSMISSION') {
                const banner = document.getElementById('announcementBanner');
                const inner = banner.querySelector('.ann-inner');
                const titleEl = document.getElementById('annTitle');
                const msgEl = document.getElementById('annMsg');
                if (!banner) return;
                if (banner._hideTimer) clearTimeout(banner._hideTimer);
                titleEl.textContent = title;
                titleEl.style.color = color;
                msgEl.textContent = msg;
                msgEl.style.color = '#fff';
                inner.style.color = color;
                inner.style.borderColor = color;
                inner.style.boxShadow = `0 0 24px rgba(0,0,0,0.7), 0 0 16px ${color}55`;
                // Re-trigger animation
                inner.style.animation = 'none';
                void inner.offsetWidth;
                inner.style.animation = '';
                banner.style.display = 'block';
                banner._hideTimer = setTimeout(() => { banner.style.display = 'none'; }, duration);
            }

            // ── STAT PREVIEW CARD ──────────────────────────────────────
            const statCard = document.getElementById('statCard');
            
            // Function to map hex color to nearest rainbow color name
            function getRainbowColorName(hexColor) {
                // Parse hex to RGB
                const r = parseInt(hexColor.slice(1, 3), 16) / 255;
                const g = parseInt(hexColor.slice(3, 5), 16) / 255;
                const b = parseInt(hexColor.slice(5, 7), 16) / 255;
                
                const max = Math.max(r, g, b);
                const min = Math.min(r, g, b);
                const delta = max - min;
                
                // Check for grayscale colors first
                if (delta < 0.05) {
                    const avg = (r + g + b) / 3;
                    if (avg < 0.1) return 'Black';
                    if (avg > 0.9) return 'White';
                    return 'Gray';
                }
                
                // Calculate hue
                let hue;
                if (delta === 0) {
                    hue = 0;
                } else if (max === r) {
                    hue = ((g - b) / delta) % 6;
                } else if (max === g) {
                    hue = (b - r) / delta + 2;
                } else {
                    hue = (r - g) / delta + 4;
                }
                hue = Math.round(hue * 60);
                if (hue < 0) hue += 360;
                
                // Map hue to rainbow color
                if (hue >= 345 || hue < 15) return 'Red';
                if (hue >= 15 && hue < 45) return 'Orange';
                if (hue >= 45 && hue < 75) return 'Yellow';
                if (hue >= 75 && hue < 165) return 'Green';
                if (hue >= 165 && hue < 195) return 'Cyan';
                if (hue >= 195 && hue < 255) return 'Blue';
                if (hue >= 255 && hue < 285) return 'Purple';
                if (hue >= 285 && hue < 315) return 'Magenta';
                if (hue >= 315 && hue < 345) return 'Pink';
                
                return 'Red';
            }
            
            function showStatCard(char, anchorEl, isLocked = false) {
                if (isLocked && char.unlockAchievement) {
                    const achievement = achievements[char.unlockAchievement];
                    const hint = achievement ? achievement.desc : 'Complete achievements to unlock this character';
                    statCard.innerHTML = `
                        <div class="sc-name" style="color:#666666">🔒 Locked Character</div>
                        <div class="sc-bio" style="margin-top:8px;color:#888888;font-style:italic">"${hint}"</div>
                    `;
                } else {
                    const w = getWeapon(char);
                    const hpPct = Math.round((char.hp / 500) * 100);
                    const tags = [];
                    if (char.isDroid) tags.push('Droid');
                    if (char.isClone) tags.push('Clone');
                    const tagStr = tags.length ? ` <span style="opacity:0.5;font-size:0.7rem">[${tags.join(', ')}]</span>` : '';
                    statCard.innerHTML = `
                        <div class="sc-name" style="color:${char.color}">${weaponEmoji[char.weapon]||'⚔️'} ${char.name}${tagStr}</div>
                        <div class="sc-row"><span>HP</span><span>${char.hp}</span></div>
                        <div class="sc-bar-wrap"><div class="sc-bar-fill" style="width:${hpPct}%;background:${char.color}"></div></div>
                        <div class="sc-row"><span>Weapon</span><span>${w.label}</span></div>
                        <div class="sc-row"><span>Damage</span><span>${Math.floor(w.damage * (1 - (w.variance||0)))} – ${Math.ceil(w.damage * (1 + (w.variance||0)))}</span></div>
                        <div class="sc-row"><span>Fire Rate</span><span>${Math.round(1000/w.cooldown*10)/10}/s</span></div>
                        ${char.saberColor ? `<div class="sc-row"><span>Saber</span><span style="color:${char.saberColor}">■ ${getRainbowColorName(char.saberColor)}</span></div>` : ''}
                        ${char.bio ? `<div class="sc-bio">${char.bio}</div>` : ''}
                    `;
                }
                const rect = anchorEl.getBoundingClientRect();
                let left = rect.right + 8;
                if (left + 220 > window.innerWidth) left = rect.left - 228;
                statCard.style.left = left + 'px';
                statCard.style.top = Math.min(rect.top, window.innerHeight - 260) + 'px';
                statCard.style.display = 'block';
            }
            function hideStatCard() { statCard.style.display = 'none'; }

            const mainMenu = document.getElementById('mainMenu');
            const splashMenu = document.getElementById('splashMenu');
            const opponentMenu = document.getElementById('opponentMenu');

            // ── SPLASH STAR FIELD ──────────────────────────────────────
            function buildStarField(containerId, count) {
                const container = document.getElementById(containerId);
                if (!container) return;
                for (let i = 0; i < count; i++) {
                    const s = document.createElement('div');
                    s.className = 'splash-star';
                    const size = Math.random() * 2.2 + 0.5;
                    const dur  = (Math.random() * 4 + 2).toFixed(2);
                    const delay = (Math.random() * 6).toFixed(2);
                    const maxOp = (Math.random() * 0.6 + 0.2).toFixed(2);
                    s.style.cssText = `
                        width:${size}px; height:${size}px;
                        left:${Math.random()*100}%; top:${Math.random()*100}%;
                        --dur:${dur}s; --max-opacity:${maxOp};
                        animation-delay:${delay}s;
                    `;
                    container.appendChild(s);
                }
            }
            buildStarField('splashStars', 90);
            buildStarField('loadingStars', 60);

            // ── FREEPLAY BUTTON ────────────────────────────────────────
            document.getElementById('btnFreeplay').addEventListener('click', () => {
                showMainMenu();
            });

            // ── SHOP BUTTON ───────────────────────────────────────────────
            const shopOverlay = document.getElementById('shopOverlay');
            const shopCloseBtn = document.getElementById('shopCloseBtn');
            const shopItemsContainer = document.getElementById('shopItems');

            const shopItems = [
                { id: 'devTeam', name: 'Dev Team', cost: 2500, description: 'Unlocks Cousin Crew character in secret characters' }
            ];

            function renderShopItems() {
                shopItemsContainer.innerHTML = '';
                shopItems.forEach(item => {
                    const isPurchased = gameUnlocks[item.id];
                    const canAfford = credits >= item.cost;
                    
                    const itemEl = document.createElement('div');
                    itemEl.style.cssText = `
                        background: rgba(255,255,255,0.05);
                        border: 1px solid ${isPurchased ? '#44ff44' : canAfford ? '#ffd700' : '#666'};
                        border-radius: 8px;
                        padding: 12px;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        gap: 12px;
                    `;
                    
                    itemEl.innerHTML = `
                        <div style="flex:1;">
                            <div style="font-family:'Orbitron',sans-serif;font-size:0.9rem;color:${isPurchased ? '#44ff44' : '#fff'};margin-bottom:4px;">
                                ${item.name} ${isPurchased ? '✓' : ''}
                            </div>
                            <div style="font-size:0.75rem;color:rgba(255,255,255,0.6);">${item.description}</div>
                        </div>
                        <button 
                            class="shop-purchase-btn"
                            data-item-id="${item.id}"
                            data-cost="${item.cost}"
                            style="
                                background: ${isPurchased ? '#44ff44' : canAfford ? '#ffd700' : '#666'};
                                color: ${isPurchased || canAfford ? '#000' : '#888'};
                                border: none;
                                border-radius: 6px;
                                padding: 8px 16px;
                                font-family:'Orbitron',sans-serif;
                                font-size: 0.8rem;
                                cursor: ${isPurchased ? 'default' : canAfford ? 'pointer' : 'not-allowed'};
                                font-weight: bold;
                            "
                            ${isPurchased ? 'disabled' : ''}
                        >
                            ${isPurchased ? 'PURCHASED' : `${item.cost} CR`}
                        </button>
                    `;
                    
                    if (!isPurchased && canAfford) {
                        itemEl.querySelector('.shop-purchase-btn').addEventListener('click', () => purchaseShopItem(item));
                    }
                    
                    shopItemsContainer.appendChild(itemEl);
                });
            }

            function purchaseShopItem(item) {
                if (credits < item.cost) return;
                if (gameUnlocks[item.id]) return;
                
                credits -= item.cost;
                gameUnlocks[item.id] = true;
                persistGalacticUnlocks();
                saveGameSettings();
                updateCreditsDisplay();
                renderShopItems();
                
                if (item.id === 'devTeam') {
                    rebuildSecretRoster();
                    updateSecretFactionSectionVisibility();
                    showAnnouncement('Cousin Crew has been unlocked!', '#808080', 4000, '🔓 CHARACTER UNLOCKED');
                }
            }

            document.getElementById('btnShop').addEventListener('click', () => {
                updateCreditsDisplay();
                renderShopItems();
                shopOverlay.style.display = 'flex';
            });
            shopCloseBtn.addEventListener('click', () => {
                shopOverlay.style.display = 'none';
            });
            shopOverlay.addEventListener('click', (e) => {
                if (e.target === shopOverlay) shopOverlay.style.display = 'none';
            });

            const vsBannerPlayer = document.getElementById('vsBannerPlayer');
            const surpriseBtn = document.getElementById('surpriseBtn');
            const backBtn = document.getElementById('backBtn');
            const messageOverlay = document.getElementById('messageOverlay');

            const defaultMenuMusicSrc = 'music/CantinaBand.m4a';
            const defaultBattleMusicSrc = 'music/DueloftheFates.m4a';
            const bendyMenuMusicSrc = 'music/Sketches.mp3';
            const bendyBattleMusicSrcs = ['music/DeathofaFriend.mp3', 'music/ASongwriterScorned.mp3', 'music/SearcherAttack.mp3'];
            let currentBendyBattleSrc = bendyBattleMusicSrcs[0];
            let bendySoundtrackEnabled = false;
            let bendyUnlocked = false;
            let musicVolume = 0.55;
            let sfxVolume   = 1.0; // 0–1 multiplier; declared here so loadGameSettings() can read it
            let credits = 0;

            function isItchHost() {
                const h = (location.hostname || '').toLowerCase();
                return h.endsWith('itch.io') || h.endsWith('itch.zone');
            }

            function loadGameSettings() {
                try {
                    const saved = JSON.parse(localStorage.getItem('galacticDuelSettings') || '{}');
                    bendySoundtrackEnabled = !!saved.bendySoundtrackEnabled;
                    bendyUnlocked = !!saved.bendyUnlocked;
                    musicVolume = typeof saved.musicVolume === 'number' ? saved.musicVolume : musicVolume;
                    sfxVolume   = typeof saved.sfxVolume   === 'number' ? saved.sfxVolume   : sfxVolume;
                    credits = typeof saved.credits === 'number' ? saved.credits : 0;
                } catch (e) {}
                updateMusicSources();
                updateCreditsDisplay();
            }

            function saveGameSettings() {
                try {
                    localStorage.setItem('galacticDuelSettings', JSON.stringify({
                        bendySoundtrackEnabled,
                        bendyUnlocked,
                        musicVolume,
                        sfxVolume,
                        credits
                    }));
                } catch (e) {}
            }

            function updateCreditsDisplay() {
                const display = document.getElementById('shopCreditsDisplay');
                if (display) display.textContent = credits;
            }

            function updateBendyToggleVisibility() {
                const btn = document.getElementById('bendyToggleBtn');
                if (!btn) return;
                btn.style.display = bendyUnlocked ? 'block' : 'none';
                btn.textContent = bendySoundtrackEnabled ? '🎵 Bendy DLC: ON' : '🎵 Bendy DLC: OFF';
            }

            const menuMusic = new Audio(defaultMenuMusicSrc);
            const battleMusic = new Audio(defaultBattleMusicSrc);
            const cantinaBandAudio = new Audio(defaultMenuMusicSrc); // Always CantinaBand, never overridden by Bendy DLC
            // Arena-specific battle tracks
            const mustafar_music  = new Audio('music/BattleoftheHeroes.mp3');
            const deathstar_music = new Audio('music/ImperialMarch.mp3');
            mustafar_music.loop  = true;
            deathstar_music.loop = true;
            menuMusic.volume = musicVolume;
            menuMusic.loop = true;
            battleMusic.volume = musicVolume;
            battleMusic.loop = true;
            cantinaBandAudio.volume = musicVolume;
            cantinaBandAudio.loop = true;
            mustafar_music.volume = musicVolume;
            deathstar_music.volume = musicVolume;
            loadGameSettings();
            updateBendyToggleVisibility();

            function applyMusicVolume() {
                menuMusic.volume = musicVolume;
                battleMusic.volume = musicVolume;
                cantinaBandAudio.volume = musicVolume;
                mustafar_music.volume  = musicVolume;
                deathstar_music.volume = musicVolume;
            }

            function updateMusicSources() {
                const menuSrc = bendySoundtrackEnabled ? bendyMenuMusicSrc : defaultMenuMusicSrc;
                const battleSrc = bendySoundtrackEnabled ? currentBendyBattleSrc : defaultBattleMusicSrc;
                if (!menuMusic.src.endsWith(menuSrc)) {
                    const wasPlaying = !menuMusic.paused && !menuMusic.ended;
                    menuMusic.pause();
                    menuMusic.currentTime = 0;
                    menuMusic.src = menuSrc;
                    menuMusic.load();
                    if (wasPlaying && currentMusic === menuMusic && musicStarted) {
                        menuMusic.play().catch(() => {});
                    }
                }
                if (!battleMusic.src.endsWith(battleSrc)) {
                    const wasPlaying = !battleMusic.paused && !battleMusic.ended;
                    battleMusic.pause();
                    battleMusic.currentTime = 0;
                    battleMusic.src = battleSrc;
                    battleMusic.load();
                    if (wasPlaying && currentMusic === battleMusic && musicStarted) {
                        battleMusic.play().catch(() => {});
                    }
                }
                applyMusicVolume();
            }

            // ── SOUND EFFECTS ─────────────────────────────────────────
            const sfxBaseVolumes = {
                walking:          0.10,
                zap:              0.12,
                forceLightning:   0.12,
                wrenchHit:        0.13,
                blasterShot:      0.15,
                bowcasterShot:    0.14,
                lightsaberIgnite: 0.15,
                lightsaberHum:    0.10,
                lightsaberClash:  0.15,
                lightsaberThrow:  0.13,
            };
            const sfxSounds = {
                walking:          new Audio('sounds/Walking.mp3'),
                zap:              new Audio('sounds/Zap.mp3'),
                forceLightning:   new Audio('sounds/ForceLightning.mp3'),
                wrenchHit:        new Audio('sounds/WrenchHit.mp3'),
                blasterShot:      new Audio('sounds/BlasterShot.mp3'),
                bowcasterShot:    new Audio('sounds/Bowcaster.mp3'),
                lightsaberIgnite: new Audio('sounds/LightsaberIgnite.mp3'),
                lightsaberHum:    new Audio('sounds/LightsaberHum.mp3'),
                lightsaberClash:  new Audio('sounds/LightsaberClash.mp3'),
                lightsaberThrow:  new Audio('sounds/LightsaberThrow.mp3'),
            };
            sfxSounds.walking.loop = true;
            sfxSounds.lightsaberHum.loop = true;
            function applySfxVolume() {
                Object.keys(sfxSounds).forEach(k => {
                    sfxSounds[k].volume = (sfxBaseVolumes[k] || 0.15) * sfxVolume;
                });
            }
            applySfxVolume();

            // ── LOADING SCREEN ─────────────────────────────────────────
            (function initLoadingScreen() {
                const loadingScreen = document.getElementById('loadingScreen');
                const loadingBarFill = document.getElementById('loadingBarFill');
                const loadingPct = document.getElementById('loadingPct');
                const loadingTip = document.getElementById('loadingTip');
                if (!loadingScreen) return;

                const assetsToTrack = [
                    menuMusic, battleMusic, cantinaBandAudio,
                    mustafar_music, deathstar_music,
                    ...Object.values(sfxSounds)
                ];
                const total = assetsToTrack.length;
                let loaded = 0;
                let finished = false;

                function updateProgress() {
                    const pct = total > 0 ? Math.min(100, Math.round((loaded / total) * 100)) : 100;
                    if (loadingBarFill) loadingBarFill.style.width = pct + '%';
                    if (loadingPct) loadingPct.textContent = pct + '%';
                }

                function finishLoading() {
                    if (finished) return;
                    finished = true;
                    if (loadingTip) loadingTip.textContent = 'Ready!';
                    updateProgress();
                    loadingScreen.classList.add('loading-done');
                    setTimeout(() => { loadingScreen.style.display = 'none'; }, 500);
                }

                function bumpProgress() {
                    loaded++;
                    updateProgress();
                    if (loaded >= total) finishLoading();
                }

                if (total === 0) {
                    finishLoading();
                    return;
                }

                updateProgress();
                assetsToTrack.forEach(audio => {
                    try { audio.preload = 'auto'; } catch (e) {}
                    if (audio.readyState >= 3) { // HAVE_FUTURE_DATA or better — already good to go
                        bumpProgress();
                        return;
                    }
                    const onReady = () => {
                        audio.removeEventListener('canplaythrough', onReady);
                        audio.removeEventListener('loadeddata', onReady);
                        audio.removeEventListener('error', onReady);
                        bumpProgress();
                    };
                    audio.addEventListener('canplaythrough', onReady, { once: true });
                    audio.addEventListener('loadeddata', onReady, { once: true });
                    audio.addEventListener('error', onReady, { once: true });
                    try { audio.load(); } catch (e) {}
                });

                // Safety net — never block the player for more than ~8s,
                // e.g. if a browser declines to fire load events while tab is backgrounded.
                setTimeout(finishLoading, 8000);
            })();

            // Cooldowns to prevent sound spam (ms timestamps)
            let _lastClashSnd = 0;
            let _lastBlasterSnd = 0;
            let _lastZapSnd = 0;
            let _lastBowcasterSnd = 0;

            function playSound(name, minGapMs = 50) {
                if (sfxVolume === 0) return;
                const snd = sfxSounds[name];
                if (!snd) return;
                const now = Date.now();
                if (name === 'lightsaberClash' && now - _lastClashSnd   < minGapMs) return;
                if (name === 'blasterShot'     && now - _lastBlasterSnd < minGapMs) return;
                if (name === 'bowcasterShot'   && now - _lastBowcasterSnd < minGapMs) return;
                if (name === 'zap'             && now - _lastZapSnd     < minGapMs) return;
                if (name === 'lightsaberClash') _lastClashSnd    = now;
                if (name === 'blasterShot')     _lastBlasterSnd  = now;
                if (name === 'bowcasterShot')   _lastBowcasterSnd = now;
                if (name === 'zap')             _lastZapSnd      = now;
                if (snd.loop) {
                    if (snd.paused) snd.play().catch(() => {});
                    return;
                }
                // Clone for overlapping one-shots
                const clone = snd.cloneNode();
                clone.volume = snd.volume;
                clone.play().catch(() => {});
            }

            function stopSound(name) {
                const snd = sfxSounds[name];
                if (!snd) return;
                snd.pause();
                snd.currentTime = 0;
            }

            function stopAllSfx() {
                Object.keys(sfxSounds).forEach(k => stopSound(k));
            }
            
            let musicStarted = false;
            let currentMusic = null;
            let seriesBendyBattleSrc = null; // Locked-in Bendy track for the whole series
            
            function playMenuMusic() {
                if (currentMusic === menuMusic) return;
                stopCurrentMusic();
                currentMusic = menuMusic;
                if (musicStarted) {
                    menuMusic.play().catch(() => {});
                }
            }
            
            function playBattleMusic() {
                // Bendy DLC override: takes priority over all arena-specific music
                if (bendySoundtrackEnabled) {
                    const isFirstRound = (playerWins + enemyWins) === 0;
                    if (isFirstRound || seriesBendyBattleSrc === null) {
                        // Pick a track, excluding the last one played so it never repeats back-to-back
                        const choices = bendyBattleMusicSrcs.filter(s => s !== currentBendyBattleSrc);
                        seriesBendyBattleSrc = choices[Math.floor(Math.random() * choices.length)];
                    }
                    const pick = seriesBendyBattleSrc;
                    if (pick !== currentBendyBattleSrc) {
                        currentBendyBattleSrc = pick;
                        // Stop whatever is currently playing FIRST, then swap the src.
                        stopCurrentMusic();
                        currentMusic = null;
                        battleMusic.pause();
                        battleMusic.currentTime = 0;
                        battleMusic.src = currentBendyBattleSrc;
                        battleMusic.load();
                    }
                    if (currentMusic === battleMusic) return;
                    stopCurrentMusic();
                    currentMusic = battleMusic;
                    if (musicStarted) {
                        battleMusic.play().catch(() => {});
                    }
                    return;
                }
                
                // Arena-specific overrides (only when Bendy DLC is disabled)
                if (currentArena === 'mustafar') {
                    if (currentMusic === mustafar_music) return;
                    stopCurrentMusic();
                    currentMusic = mustafar_music;
                    if (musicStarted) mustafar_music.play().catch(() => {});
                    return;
                }
                if (currentArena === 'deathstar') {
                    if (currentMusic === deathstar_music) return;
                    stopCurrentMusic();
                    currentMusic = deathstar_music;
                    if (musicStarted) deathstar_music.play().catch(() => {});
                    return;
                }
                if (currentArena === 'moseisley') {
                    if (currentMusic === cantinaBandAudio) return;
                    stopCurrentMusic();
                    currentMusic = cantinaBandAudio;
                    if (musicStarted) {
                        cantinaBandAudio.play().catch(() => {});
                    }
                    return;
                }
                
                // Default battle music
                if (currentMusic === battleMusic) return;
                stopCurrentMusic();
                currentMusic = battleMusic;
                if (musicStarted) {
                    battleMusic.play().catch(() => {});
                }
            }
            
            function stopCurrentMusic() {
                if (currentMusic) {
                    currentMusic.pause();
                    currentMusic.currentTime = 0;
                }
            }
            
            function tryStartMusic() {
                if (musicStarted) return;
                musicStarted = true;
                playMenuMusic();
            }
            document.addEventListener('click', tryStartMusic, { once: true });
            document.addEventListener('keydown', tryStartMusic, { once: true });
            document.addEventListener('pointerdown', tryStartMusic, { once: true });

            const settingsBtn = document.getElementById('settingsBtn');
            const settingsPanel = document.getElementById('settingsPanel');
            const bendyToggleBtn = document.getElementById('bendyToggleBtn');
            const redeemCodeInput = document.getElementById('redeemCodeInput');
            const redeemCodeBtn = document.getElementById('redeemCodeBtn');

            // ── VOLUME SLIDERS ──────────────────────────────────────────
            const musicVolumeSlider = document.getElementById('musicVolumeSlider');
            const sfxVolumeSlider   = document.getElementById('sfxVolumeSlider');

            // Sync sliders to loaded values
            musicVolumeSlider.value = musicVolume;
            sfxVolumeSlider.value   = sfxVolume;

            musicVolumeSlider.addEventListener('input', (e) => {
                e.stopPropagation();
                tryStartMusic();
                musicVolume = parseFloat(e.target.value);
                applyMusicVolume();
                saveGameSettings();
            });

            sfxVolumeSlider.addEventListener('input', (e) => {
                e.stopPropagation();
                sfxVolume = parseFloat(e.target.value);
                applySfxVolume();
                if (sfxVolume === 0) stopAllSfx();
                saveGameSettings();
            });

            settingsBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const isOpen = settingsPanel.style.display === 'block';
                settingsPanel.style.display = isOpen ? 'none' : 'block';
            });

            document.addEventListener('click', (e) => {
                if (settingsPanel.style.display === 'block') {
                    if (e.target === settingsBtn || settingsBtn.contains(e.target)) return;
                    if (settingsPanel.contains(e.target)) return;
                    settingsPanel.style.display = 'none';
                }
            });

            if (bendyToggleBtn) {
                bendyToggleBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (!bendyUnlocked) return;
                    toggleBendySoundtrack();
                });
            }

            document.getElementById('clearDataBtn').addEventListener('click', (e) => {
                e.stopPropagation();
                if (confirm('Are you sure you want to clear all data? This will reset achievements, unlocks, and settings.')) {
                    localStorage.clear();
                    location.reload();
                }
            });

            function toggleBendySoundtrack() {
                bendySoundtrackEnabled = !bendySoundtrackEnabled;
                bendyUnlocked = true;
                updateMusicSources();
                saveGameSettings();
                updateBendyToggleVisibility();
                if (musicStarted && currentMusic) {
                    currentMusic.pause();
                    currentMusic.currentTime = 0;
                    currentMusic.play().catch(() => {});
                }
                showAnnouncement('Bendy Soundtrack ' + (bendySoundtrackEnabled ? 'Enabled' : 'Disabled') + '.', '#ff9900', 3000, '🎵 BENDY DLC');
            }

            redeemCodeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const code = redeemCodeInput.value.trim().toUpperCase();
                if (code === 'BENDY') {
                    bendyUnlocked = true;
                    bendySoundtrackEnabled = true;
                    updateMusicSources();
                    saveGameSettings();
                    updateBendyToggleVisibility();
                    showAnnouncement('Bendy Soundtrack unlocked! Use the Bendy DLC toggle in settings.', '#ff9900', 4000, '🔓 UNLOCKED');
                } else if (code) {
                    showAnnouncement('Code 201c' + code + '201d is not recognized.', '#ff6666', 3000, '❌ INVALID CODE');
                }
                redeemCodeInput.value = '';
            });

            redeemCodeInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    redeemCodeBtn.click();
                }
            });

            // ── FULLSCREEN ─────────────────────────────────────────────
            const fullscreenBtn = document.getElementById('fullscreenBtn');
            // iOS Safari (and other browsers without any Fullscreen API) can't
            // honor requestFullscreen — the button would silently no-op there,
            // so just hide it for the whole session.
            const fullscreenSupported = !!(
                document.documentElement.requestFullscreen ||
                document.documentElement.webkitRequestFullscreen ||
                document.documentElement.mozRequestFullScreen ||
                document.documentElement.msRequestFullscreen
            );
            if (!fullscreenSupported) {
                fullscreenBtn.style.display = 'none';
            }
            function updateFullscreenIcon() {
                fullscreenBtn.textContent = document.fullscreenElement ? '✕' : '⛶';
                fullscreenBtn.title = document.fullscreenElement ? 'Exit Fullscreen' : 'Fullscreen';
            }
            fullscreenBtn.addEventListener('click', () => {
                if (!document.fullscreenElement) {
                    (document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen || (() => {})).call(document.documentElement);
                } else {
                    (document.exitFullscreen || document.webkitExitFullscreen || (() => {})).call(document);
                }
            });
            document.addEventListener('fullscreenchange', updateFullscreenIcon);
            document.addEventListener('webkitfullscreenchange', updateFullscreenIcon);

            // ── CONTROLS OVERLAY ───────────────────────────────────────
            const controlsOverlay  = document.getElementById('controlsOverlay');
            const controlsGrid     = document.getElementById('controlsGrid');
            const controlsInputLabel = document.getElementById('controlsInputLabel');
            const controlsCloseBtn = document.getElementById('controlsCloseBtn');
            const controlsBtn      = document.getElementById('controlsBtn');

            const KB_CONTROLS = [
                { key: 'W A S D',   wide: true,  desc: 'Move' },
                { key: 'Space',     wide: true,  desc: 'Shoot / Attack' },
                { key: 'Esc',       wide: false, desc: 'Pause' },
                { key: 'Enter',     wide: false, desc: 'Confirm' },
            ];

            const TOUCH_CONTROLS = [
                { key: 'Joystick',  wide: true,  desc: 'Move' },
                { key: '🔫 Button', wide: true,  desc: 'Shoot / Attack' },
            ];

            function buildControlsGrid(list) {
                controlsGrid.innerHTML = '';
                list.forEach(({ key, wide, desc }) => {
                    const row = document.createElement('div');
                    row.className = 'control-row';
                    row.innerHTML = `<span class="control-key${wide ? ' wide' : ''}">${key}</span><span class="control-desc">${desc}</span>`;
                    controlsGrid.appendChild(row);
                });
            }

            function detectInputType() {
                const isTouchOnly = window.matchMedia('(pointer: coarse)').matches && !window.matchMedia('(pointer: fine)').matches;
                if (isTouchOnly) return 'touch';
                return 'keyboard';
            }

            function openControlsOverlay() {
                const type = detectInputType();
                if (type === 'touch') {
                    controlsInputLabel.textContent = 'Touchscreen';
                    buildControlsGrid(TOUCH_CONTROLS);
                } else {
                    controlsInputLabel.textContent = 'Keyboard';
                    buildControlsGrid(KB_CONTROLS);
                }
                settingsPanel.style.display = 'none';
                controlsOverlay.classList.add('open');
            }

            function closeControlsOverlay() {
                controlsOverlay.classList.remove('open');
            }

            controlsBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                openControlsOverlay();
            });
            controlsCloseBtn.addEventListener('click', closeControlsOverlay);
            controlsOverlay.addEventListener('click', (e) => {
                if (e.target === controlsOverlay) closeControlsOverlay();
            });
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && controlsOverlay.classList.contains('open')) {
                    closeControlsOverlay();
                }
            });

            // ── MATCH HISTORY OVERLAY ──────────────────────────────────
            const historyOverlay   = document.getElementById('historyOverlay');
            const historyTableBody = document.getElementById('historyTableBody');
            const historyEmpty     = document.getElementById('historyEmpty');
            const historyTable     = document.getElementById('historyTable');
            const historyCount     = document.getElementById('historyCount');
            const MAX_HISTORY_ENTRIES = 100;

            function openHistoryOverlay() {
                settingsPanel.style.display = 'none';
                try {
                    const history = JSON.parse(localStorage.getItem('galacticDuelHistory') || '[]');
                    historyTableBody.innerHTML = '';
                    if (history.length === 0) {
                        historyEmpty.style.display = 'block';
                        historyTable.style.display = 'none';
                        if (historyCount) historyCount.textContent = '';
                    } else {
                        historyEmpty.style.display = 'none';
                        historyTable.style.display = 'table';
                        const fragment = document.createDocumentFragment();
                        history.forEach((m, i) => {
                            const tr = document.createElement('tr');
                            tr.style.borderBottom = '1px solid rgba(255,255,255,0.05)';
                            tr.style.background = (i % 2 === 1) ? 'rgba(255,255,255,0.025)' : 'transparent';
                            const win = m.result === 'W';
                            const resultColor = win ? '#00A4FF' : '#FF3333';
                            const dmg  = typeof m.damage   === 'number' ? m.damage   : '—';
                            const acc  = typeof m.accuracy === 'number' ? m.accuracy + '%' : '—';
                            tr.innerHTML = `
                                <td style="padding:6px 8px;color:rgba(255,255,255,0.45);">${m.date||'—'}</td>
                                <td style="padding:6px 8px;color:#e8e8e8;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${m.player}</td>
                                <td style="padding:6px 8px;color:rgba(255,255,255,0.5);max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${m.enemy}</td>
                                <td style="padding:6px 8px;text-align:center;color:${resultColor};font-weight:bold;">${win ? '✓ WIN' : '✗ LOSS'}</td>
                                <td style="padding:6px 8px;text-align:center;color:#e8e8e8;">${dmg}</td>
                                <td style="padding:6px 8px;text-align:center;color:#e8e8e8;">${acc}</td>
                                <td style="padding:6px 8px;text-align:center;color:rgba(255,255,255,0.4);text-transform:capitalize;">${m.difficulty||'—'}</td>
                            `;
                            fragment.appendChild(tr);
                        });
                        historyTableBody.appendChild(fragment);
                        if (historyCount) {
                            historyCount.textContent = history.length >= MAX_HISTORY_ENTRIES
                                ? `Showing most recent ${MAX_HISTORY_ENTRIES} matches (older matches are trimmed)`
                                : `${history.length} match${history.length === 1 ? '' : 'es'} recorded`;
                        }
                    }
                } catch(e) {}
                historyOverlay.style.display = 'flex';
            }

            document.getElementById('historyBtn').addEventListener('click', (e) => {
                e.stopPropagation();
                openHistoryOverlay();
            });
            document.getElementById('historyCloseBtn').addEventListener('click', () => {
                historyOverlay.style.display = 'none';
            });
            document.getElementById('historyClearBtn').addEventListener('click', () => {
                if (confirm('Clear all match history?')) {
                    localStorage.removeItem('galacticDuelHistory');
                    openHistoryOverlay();
                }
            });
            historyOverlay.addEventListener('click', (e) => {
                if (e.target === historyOverlay) historyOverlay.style.display = 'none';
            });

            // Achievements overlay
            const achievementsOverlay = document.getElementById('achievementsOverlay');
            const achievementsList = document.getElementById('achievementsList');

            function openAchievementsOverlay() {
                achievementsList.innerHTML = '';
                const achievementIds = Object.keys(achievements).sort();
                let unlockedCount = 0;

                achievementIds.forEach(id => {
                    const a = achievements[id];
                    if (a.done) unlockedCount++;

                    const item = document.createElement('div');
                    item.className = `achievement-item ${a.done ? 'unlocked' : ''}`;
                    item.innerHTML = `
                        <div class="achievement-icon">${a.done ? '🏆' : '🔒'}</div>
                        <div class="achievement-info">
                            <div class="achievement-name">${a.label}</div>
                            <div class="achievement-desc">${a.desc}</div>
                        </div>
                        <div class="achievement-status">${a.done ? 'UNLOCKED' : 'LOCKED'}</div>
                    `;
                    achievementsList.appendChild(item);
                });

                achievementsOverlay.style.display = 'flex';
            }

            document.getElementById('achievementsBtn').addEventListener('click', (e) => {
                e.stopPropagation();
                openAchievementsOverlay();
            });
            document.getElementById('achievementsCloseBtn').addEventListener('click', () => {
                achievementsOverlay.style.display = 'none';
            });
            achievementsOverlay.addEventListener('click', (e) => {
                if (e.target === achievementsOverlay) achievementsOverlay.style.display = 'none';
            });

            const messageText = document.getElementById('messageText');
            const restartButton = document.getElementById('restartButton');
            const hud = document.getElementById('hud');

            const playerHealthBar = document.getElementById('playerHealthBar');
            const enemyHealthBar = document.getElementById('enemyHealthBar');
            const playerLabel = document.getElementById('playerLabel');
            const enemyLabel = document.getElementById('enemyLabel');
            const playerHealthText = document.getElementById('playerHealthText');
            const enemyHealthText = document.getElementById('enemyHealthText');

            /** Motion & tuning values are normalized to this framerate (delta-time scaled in the game loop). */
            const TARGET_FPS = 60;
            const PLAYER_SPEED = 3.5;
            const CHARACTER_SIZE = 18;
            
            // WEAPON LIBRARY
            const WEAPON_LIBRARY = {
                blaster:    { key: 'blaster',    label: 'Blaster',        damage: 25, variance: 0.10, speed: 8,   cooldown: 400, spin: false, draw: 'bolt',   color: '#ffffff', length: 18 },
                lightsaber: { key: 'lightsaber', label: 'Lightsaber',     damage: 18, variance: 0.12, speed: 8,   cooldown: 500, spin: true,  draw: 'saber',  color: '#ffffff', length: 42, returnable: true },
                wrench:     { key: 'wrench',     label: 'Wrench',         damage: 18, variance: 0.15, speed: 7,   cooldown: 420, spin: true,  draw: 'wrench', color: '#b8bec7', length: 24, vsDroidMultiplier: 2, returnable: true },
                zap:        { key: 'zap',        label: 'Zap',            damage: 12, variance: 0.08, speed: 9,   cooldown: 300, spin: false, draw: 'zap',    color: '#7efcff', length: 24 },
                staff:      { key: 'staff',      label: 'Electrostaff',   damage: 17, variance: 0.12, speed: 7.5, cooldown: 380, spin: true,  draw: 'staff',  color: '#c4ff6a', length: 34, returnable: true },
                bowcaster:  { key: 'bowcaster',  label: 'Bowcaster',      damage: 25, variance: 0.10, speed: 9,   cooldown: 650, spin: false, draw: 'bolt',   color: '#33ff33', length: 22 },
                darksaber:  { key: 'darksaber',  label: 'Darksaber',      damage: 22, variance: 0.12, speed: 8.5, cooldown: 480, spin: true,  draw: 'saber',  color: '#ffffff', length: 38, returnable: true },
                lightning:  { key: 'lightning',  label: 'Sith Lightning', damage: 30, variance: 0.08, speed: 12,  cooldown: 250, spin: true,  draw: 'zap',    color: '#cc00ff', length: 32 },
                computer:   { key: 'computer',   label: 'Computer',       damage: 47, variance: 0.06, speed: 9,   cooldown: 600, spin: false, draw: 'zap',    color: '#808080', length: 24 }
            };

            function getWeapon(charData) {
                const base = WEAPON_LIBRARY[charData?.weapon || 'blaster'] || WEAPON_LIBRARY.blaster;
                return { ...base, damage: charData?.weaponDamage ?? base.damage };
            }

            // --- MASSIVE ROSTER EXPANSION ---
            const characters = {
                heroes: [
                    // --- CLONE COMMANDERS & LEGIONS ---
                    { id: '501st', name: '501st Legion', color: '#0077ff', hp: 140, weapon: 'blaster', isClone: true, bio: 'Anakin Skywalker\'s elite legion. Led by Captain Rex, they served with distinction across the Clone Wars.' },
                    { id: '212th', name: '212th Attack Battalion', color: '#ff9900', hp: 130, weapon: 'blaster', isClone: true, bio: 'Led by Commander Cody and Obi-Wan Kenobi. Known for their distinctive orange armor and siege tactics.' },
                    { id: '104th', name: '104th Wolfpack', color: '#999999', hp: 125, weapon: 'blaster', isClone: true, bio: 'Led by Commander Wolffe and Jedi Master Plo Koon. Elite reconnaissance unit with distinctive grey armor.' },
                    { id: 'coruscant', name: 'Coruscant Guard', color: '#ff0000', hp: 110, weapon: 'blaster', isClone: true, bio: 'Elite security force protecting the Galactic Senate and Supreme Chancellor. Led by Commander Fox.' },
                    { id: '327th', name: '327th Star Corps', color: '#ffff00', hp: 120, weapon: 'blaster', isClone: true, bio: 'Led by Commander Bly and Aayla Secura. Distinguished by their yellow armor and rapid deployment tactics.' },
                    { id: '41st', name: '41st Elite Corps', color: '#44ff44', hp: 130, weapon: 'blaster', isClone: true, bio: 'Specialized in jungle and swamp warfare. Led by Commander Gree and Jedi Master Luminara Unduli.' },
                    { id: '52nd', name: '52nd Star Corps', color: '#8b4513', hp: 125, weapon: 'blaster', isClone: true, bio: 'Led by Captain Keeli. Known for their fierce loyalty and combat effectiveness in planetary assaults.' },
                    { id: '91st', name: '91st Recon Corps', color: '#ff4444', hp: 115, weapon: 'blaster', isClone: true, bio: 'Specialized reconnaissance and scouting unit. Led by Commander Neyo with distinctive red armor.' },
                    { id: '187th', name: '187th Legion', color: '#a000ff', hp: 125, weapon: 'blaster', isClone: true, bio: 'Led by Commander Bacara and Jedi Master Ki-Adi-Mundi. Elite legion with purple markings.' },
                    { id: '21st', name: '21st Nova Corps', color: '#800000', hp: 135, weapon: 'blaster', isClone: true, bio: 'Elite special forces unit. Led by Commander Ponds and Jedi Master Mace Windu. The best of the best.' },
                    { id: '442nd', name: '442nd Siege Battalion', color: '#008000', hp: 120, weapon: 'blaster', isClone: true, bio: 'Specialized in heavy assault and siege breaking. Led by Commander Doom with distinctive green armor.' },
                    { id: '612th', name: '612th Attack Battalion', color: '#ff6666', hp: 115, weapon: 'blaster', isClone: true, bio: 'Elite attack battalion with red and grey armor markings. Led by Commander Ganch under Jedi Bolla Ropal.' },
                    { id: 'rancor', name: 'Rancor Battalion', color: '#cc66cc', hp: 125, weapon: 'blaster', isClone: true, bio: 'Elite ARC trooper battalion that trained cadets on Kamino. Led by Commander Colt under Shaak Ti with maroon and grey armor.' },
                    { id: '184th', name: '184th Attack Battalion', color: '#666699', hp: 118, weapon: 'blaster', isClone: true, bio: 'Infantry battalion with distinctive blue-grey armor. Led by Commander Crane under Jedi Jor Aerith.' },
                    { id: 'rex', name: 'Captain Rex', color: '#00d4ff', hp: 165, weapon: 'blaster', isClone: true, bio: 'Anakin Skywalker\'s second-in-command. One of the most respected clones in the Grand Army. Refused to execute Order 66.' },
                    { id: 'cody', name: 'Commander Cody', color: '#ff9900', hp: 155, weapon: 'blaster', isClone: true, bio: 'Obi-Wan Kenobi\'s loyal commander. Led the 212th with distinction. Tragically carried out Order 66 on Utapau.' },
                    { id: 'wolffe', name: 'Commander Wolffe', color: '#999999', hp: 150, weapon: 'blaster', isClone: true, bio: 'Leader of the Wolfpack under Plo Koon. Lost his eye in battle but never lost his fighting spirit.' },
                    { id: 'bly', name: 'Commander Bly', color: '#ffff00', hp: 155, weapon: 'blaster', isClone: true, bio: 'Aayla Secura\'s trusted commander. Led the 327th with honor. Executed Order 66 on Felucia.' },
                    { id: 'gree', name: 'Commander Gree', color: '#44ff44', hp: 155, weapon: 'blaster', isClone: true, bio: 'Expert in jungle warfare under Luminara Unduli. Executed Order 66 on Kashyyyk alongside Yoda.' },
                    { id: 'fox', name: 'Commander Fox', color: '#ff0000', hp: 150, weapon: 'blaster', isClone: true, bio: 'Leader of the Coruscant Guard. Fiercely loyal to the Chancellor. Executed Fives to protect Order 66.' },
                    { id: 'bacara', name: 'Commander Bacara', color: '#800000', hp: 160, weapon: 'blaster', isClone: true, bio: 'Ki-Adi-Mundi\'s commander. Led the 187th in the Outer Rim sieges. Executed Order 66 on Mygeeto.' },
                    { id: 'neyo', name: 'Commander Neyo', color: '#ff4444', hp: 155, weapon: 'blaster', isClone: true, bio: 'Leader of the 91st Recon Corps. Executed Order 66 on Stass Allie during a speeder bike patrol.' },
                    { id: 'appo', name: 'Commander Appo', color: '#0077ff', hp: 150, weapon: 'blaster', isClone: true, bio: 'Rex\'s successor as commander of the 501st. Led the raid on the Jedi Temple under Vader.' },
                    { id: 'doom', name: 'Commander Doom', color: '#00aa00', hp: 160, weapon: 'blaster', isClone: true, bio: 'Leader of the 442nd Siege Battalion. Expert in heavy assault tactics and breaking fortified positions.' },
                    { id: 'ponds', name: 'Commander Ponds', color: '#a000ff', hp: 150, weapon: 'blaster', isClone: true, bio: 'Mace Windu\'s trusted second-in-command. Led the 21st Nova Corps with distinction. Captured and executed by Grievous.' },
                    { id: 'thorn', name: 'Commander Thorn', color: '#ff0000', hp: 160, weapon: 'blaster', isClone: true, bio: 'Coruscant Guard commander. Heroically sacrificed himself defending Senator Amidala on Scipio.' },
                    { id: 'keeli', name: 'Captain Keeli', color: '#8b4513', hp: 155, weapon: 'blaster', isClone: true, bio: 'Leader of the Outer Rim Garrison. Died defending a medical station on Ryloth, buying time for civilians to escape.' },
                    { id: 'ganch', name: 'Commander Ganch', color: '#ff6666', hp: 150, weapon: 'blaster', isClone: true, bio: 'Leader of the 612th Attack Battalion. Served under Jedi Bolla Ropal with distinctive red and grey armor.' },
                    { id: 'colt', name: 'Commander Colt', color: '#cc66cc', hp: 165, weapon: 'blaster', isClone: true, bio: 'ARC Commander of the Rancor Battalion. Trained cadets on Kamino alongside Shaak Ti. Killed during the Battle of Kamino.' },
                    { id: 'crane', name: 'Commander Crane', color: '#666699', hp: 155, weapon: 'blaster', isClone: true, bio: 'Leader of the 184th Attack Battalion under Jor Aerith. Tragically executed Order 66 on his own general.' },

                    // --- JEDI & FORCE USERS ---
                    { id: 'anakin', name: 'Anakin Skywalker', color: '#0077ff', hp: 220, weapon: 'lightsaber', saberColor: '#5599ff', ability: 'force_push', bio: 'The Chosen One. His fall to the dark side shattered the Jedi Order.' },
                    { id: 'obiwan', name: 'Obi-Wan Kenobi', color: '#00ccff', hp: 200, weapon: 'lightsaber', saberColor: '#55bbff', ability: 'force_push', bio: 'Master of Soresu. "Hello there."' },
                    { id: 'quigon', name: 'Qui-Gon Jinn', color: '#00ff00', hp: 200, weapon: 'lightsaber', saberColor: '#00ff00', ability: 'healing', bio: 'A maverick Jedi Master who trusted the Living Force above the Council.' },
                    { id: 'ahsoka', name: 'Ahsoka Tano', color: '#33ff00', hp: 185, weapon: 'lightsaber', saberColor: '#ccffee', ability: 'double_blade', bio: 'Anakin\'s former Padawan. She walked away from the Order — and survived.' },
                    { id: 'yoda', name: 'Yoda', color: '#44ff00', hp: 250, weapon: 'lightsaber', saberColor: '#66ff44', ability: 'force_push', bio: 'Do or do not. There is no try. 900 years of wisdom in a very small package.' },
                    { id: 'windu', name: 'Mace Windu', color: '#a000ff', hp: 235, weapon: 'lightsaber', saberColor: '#cc44ff', ability: 'force_push', bio: 'The only Jedi to wield a purple lightsaber through Vaapad mastery.' },
                    { id: 'mace_windu', name: 'Mace Windu (Elite)', color: '#9900cc', hp: 245, weapon: 'lightsaber', saberColor: '#aa00dd', ability: 'force_push', unlockAchievement: 'winStreak5', bio: 'Unlocked through mastery. His power is unmatched in the Council.' },
                    { id: 'luke', name: 'Luke Skywalker', color: '#8ae1ff', hp: 205, weapon: 'lightsaber', saberColor: '#9ce9ff', ability: 'force_push', bio: 'Farm boy turned Jedi Knight. Redeemed his father with hope instead of hate.' },
                    { id: 'rey', name: 'Rey Skywalker', color: '#ffff00', hp: 200, weapon: 'lightsaber', saberColor: '#ffff00', ability: 'healing', bio: 'Rose from scavenger to the last Jedi. Her power rivals any who came before.' },
                    { id: 'calkestis', name: 'Cal Kestis', color: '#ff9900', hp: 190, weapon: 'lightsaber', saberColor: '#0088ff', ability: 'speed_boost', bio: 'A Padawan who survived Order 66 and rebuilt the Holocron of Jedi younglings.' },
                    { id: 'kanan', name: 'Kanan Jarrus', color: '#00ccff', hp: 185, weapon: 'lightsaber', saberColor: '#0055ff', ability: 'force_push', bio: 'Hera\'s co-pilot and mentor of Ezra. Gave his sight — then his life — for the crew.' },
                    { id: 'ezra', name: 'Ezra Bridger', color: '#00ff00', hp: 180, weapon: 'lightsaber', saberColor: '#00ff00', ability: 'force_push', bio: 'A street kid from Lothal who became a Jedi and helped free his home planet.' },
                    { id: 'kitfisto', name: 'Kit Fisto', color: '#00ff88', hp: 210, weapon: 'lightsaber', saberColor: '#00ff88', ability: 'force_push', bio: 'Jedi Master known for his smile and skill in underwater combat. Fought bravely in the Clone Wars.' },
                    { id: 'plokoan', name: 'Plo Koon', color: '#888888', hp: 220, weapon: 'lightsaber', saberColor: '#00aaff', ability: 'force_push', bio: 'Jedi Master and Kel Dor who discovered Ahsoka Tano. Commander of the 104th Wolfpack.' },
                    { id: 'kiadimundi', name: 'Ki-Adi-Mundi', color: '#0066ff', hp: 215, weapon: 'lightsaber', saberColor: '#0066ff', ability: 'force_push', bio: 'Jedi Master with a binary brain. Led the 187th Legion and served on the Jedi Council.' },
                    { id: 'aayla', name: 'Aayla Secura', color: '#00ffff', hp: 195, weapon: 'lightsaber', saberColor: '#00ffff', ability: 'force_push', bio: 'Twilek Jedi Master skilled in Form IV. Led the 327th Star Corps with Commander Bly.' },
                    { id: 'shaakti', name: 'Shaak Ti', color: '#ff6699', hp: 200, weapon: 'lightsaber', saberColor: '#ff6699', ability: 'force_push', bio: 'Togruta Jedi Master who trained clone cadets on Kamino. Survived Order 66 and went into hiding.' },
                    { id: 'luminara', name: 'Luminara Unduli', color: '#00ffaa', hp: 190, weapon: 'lightsaber', saberColor: '#00ffaa', ability: 'force_push', bio: 'Mirialan Jedi Master and master of Barriss Offee. Led the 41st Elite Corps on Kashyyyk.' },
                    { id: 'barriss', name: 'Barriss Offee', color: '#00cc88', hp: 175, weapon: 'lightsaber', saberColor: '#00cc88', ability: 'force_push', bio: 'Mirialan Jedi Padawan who betrayed the Order. Framed Ahsoka for terrorism.' },
                    { id: 'saseetee', name: 'Saesee Tiin', color: '#6666ff', hp: 205, weapon: 'lightsaber', saberColor: '#6666ff', ability: 'force_push', bio: 'Iktotchi Jedi Master and pilot. Served on the Jedi Council and fought in many battles.' },
                    { id: 'evenpiell', name: 'Even Piell', color: '#ff9966', hp: 180, weapon: 'lightsaber', saberColor: '#ff9966', ability: 'force_push', bio: 'Lannik Jedi Master known for his toughness and combat skills. Survived the Citadel prison break.' },
                    { id: 'coleman', name: 'Coleman Kcaj', color: '#ffcc00', hp: 190, weapon: 'lightsaber', saberColor: '#ffcc00', ability: 'force_push', bio: 'Ongree Jedi Master on the High Council. Skilled strategist and diplomat.' },
                    { id: 'oppo', name: 'Oppo Rancisis', color: '#9966ff', hp: 185, weapon: 'lightsaber', saberColor: '#9966ff', ability: 'force_push', bio: 'Thisspiasian Jedi Master and military strategist. Served on the Council for decades.' },
                    { id: 'yaddle', name: 'Yaddle', color: '#44ff44', hp: 220, weapon: 'lightsaber', saberColor: '#44ff44', ability: 'force_push', bio: 'Female Jedi Master of Yoda\'s species. Wise and powerful, though rarely seen.' },
                    { id: 'depabillaba', name: 'Depa Billaba', color: '#ff6666', hp: 200, weapon: 'lightsaber', saberColor: '#ff6666', ability: 'force_push', bio: 'Human Jedi Master who trained Kanan Jarrus. Led the 91st Recon Corps on Haruun Kal.' },
                    { id: 'krell', name: 'Pong Krell', color: '#9933ff', hp: 230, weapon: 'lightsaber', saberColor: '#9933ff', ability: 'double_blade', bio: 'Besalisk Jedi Master who turned traitor. Wielded two double-bladed lightsabers. Executed by clones.' },
                    { id: 'eeth', name: 'Eeth Koth', color: '#ffaa00', hp: 195, weapon: 'lightsaber', saberColor: '#ffaa00', ability: 'force_push', bio: 'Iridonian Zabrak Jedi Master. Served on the Council and survived Order 66 initially.' },
                    { id: 'adi', name: 'Adi Gallia', color: '#ff6666', hp: 190, weapon: 'lightsaber', saberColor: '#ff6666', ability: 'force_push', bio: 'Tholothian Jedi Master and skilled pilot. Killed by Savage Opress during the Clone Wars.' },
                    { id: 'agen', name: 'Agen Kolar', color: '#006600', hp: 200, weapon: 'lightsaber', saberColor: '#006600', ability: 'force_push', bio: 'Zabrak Jedi Master known for his combat skills. Killed by Palpatine alongside other Jedi.' },
                    { id: 'stass', name: 'Stass Allie', color: '#6699ff', hp: 185, weapon: 'lightsaber', saberColor: '#6699ff', ability: 'force_push', bio: 'Tholothian Jedi Master and cousin of Adi Gallia. Executed by Commander Neyo on Saleucami.' },

                    // --- REBELS, RESISTANCE & SMUGGLERS ---
                    { id: 'padme', name: 'Padmé Amidala', color: '#ffffff', hp: 150, weapon: 'blaster', ability: 'rally', bio: 'Senator, queen, and secret wife of Anakin. She never stopped believing in the Republic.' },
                    { id: 'han', name: 'Han Solo', color: '#ffcc00', hp: 160, weapon: 'blaster', ability: 'thermal_detonator', bio: 'Made the Kessel Run in 12 parsecs. Shot first. Reluctant hero of the galaxy.' },
                    { id: 'leia', name: 'Leia Organa', color: '#ffffff', hp: 155, weapon: 'blaster', ability: 'rally', bio: 'General, princess, and Force-sensitive rebel leader. Never lost hope.' },
                    { id: 'lando', name: 'Lando Calrissian', color: '#00ccff', hp: 150, weapon: 'blaster', ability: 'stealth', bio: 'Administrator of Cloud City and smooth-talking gambler. He came through in the end.' },
                    { id: 'finn', name: 'Finn', color: '#ff9900', hp: 155, weapon: 'blaster', ability: 'rally', bio: 'Stormtrooper FN-2187 who chose the Resistance. "That\'s not how the Force works!"' },
                    { id: 'finn_elite', name: 'Finn (Elite)', color: '#0066ff', hp: 170, weapon: 'lightsaber', saberColor: '#0088ff', ability: 'rally', unlockAchievement: 'firstWin', bio: 'Former stormtrooper who found his true calling. Now wields a blue lightsaber in defense of the Resistance.' },
                    { id: 'poe', name: 'Poe Dameron', color: '#ff4444', hp: 150, weapon: 'blaster', ability: 'sniper_shot', bio: 'The best pilot in the Resistance. Black Leader. Never leaves a wingman behind.' },
                    { id: 'jyn', name: 'Jyn Erso', color: '#aaaaaa', hp: 155, weapon: 'blaster', ability: 'thermal_detonator', bio: 'Stole the Death Star plans and paid the ultimate price. Rebellions are built on hope.' },
                    { id: 'cassian', name: 'Cassian Andor', color: '#666666', hp: 150, weapon: 'blaster', ability: 'sniper_shot', bio: 'Intelligence officer who\'s done terrible things for the Rebellion. Has a droid.' },
                    { id: 'hera', name: 'Hera Syndulla', color: '#00ff00', hp: 145, weapon: 'blaster', ability: 'rally', bio: 'Captain of the Ghost. One of the best pilots in the Rebel Alliance.' },
                    { id: 'sabine', name: 'Sabine Wren', color: '#ff00ff', hp: 160, weapon: 'darksaber', saberColor: '#000000', ability: 'thermal_detonator', bio: 'Mandalorian artist and explosives expert. Wields the Darksaber with flair.' },
                    { id: 'zeb', name: 'Zeb Orrelios', color: '#a000ff', hp: 180, weapon: 'staff', ability: 'double_blade', bio: 'Last surviving Lasat Honor Guard. Massive, loyal, and deadly with his bo-rifle.' },
                    { id: 'chewie', name: 'Chewbacca', color: '#8b4513', hp: 215, weapon: 'bowcaster', isWookiee: true, ability: 'double_blade', bio: 'Han\'s co-pilot and best friend. 200-year-old Wookiee warrior. Always pays his debts.' },
                    { id: 'mando', name: 'The Mandalorian', color: '#b0b5b9', hp: 190, weapon: 'darksaber', saberColor: '#000000', ability: 'jetpack', bio: 'This is the way. Din Djarin — protector of Grogu and bearer of the Darksaber.' },
                    { id: 'bokatan', name: 'Bo-Katan Kryze', color: '#0077ff', hp: 170, weapon: 'blaster', ability: 'jetpack', bio: 'Rightful ruler of Mandalore. Fights to reclaim her people\'s home and honor.' },
                    { id: 'ackbar', name: 'Admiral Ackbar', color: '#ffaa00', hp: 140, weapon: 'blaster', ability: 'rally', bio: 'It\'s a trap! Supreme Commander of the Rebel fleet at the Battle of Endor.' },
                    { id: 'wedge', name: 'Wedge Antilles', color: '#ff6600', hp: 145, weapon: 'blaster', ability: 'sniper_shot', bio: 'Legendary pilot who flew in both Death Star battles. Founder of Rogue Squadron.' },
                    { id: 'biggs', name: 'Biggs Darklighter', color: '#ffaa00', hp: 140, weapon: 'blaster', ability: 'sniper_shot', bio: 'Luke\'s childhood friend from Tatooine. Died protecting Luke during the Battle of Yavin.' },
                    { id: 'crix', name: 'Crix Madine', color: '#666666', hp: 135, weapon: 'blaster', ability: 'rally', bio: 'Imperial officer who defected to the Rebellion. Planned the Endor mission.' },
                    { id: 'jan', name: 'Jan Dodonna', color: '#888888', hp: 130, weapon: 'blaster', ability: 'rally', bio: 'Veteran of the Clone Wars who became a Rebel general. Briefed pilots before Yavin.' },
                    { id: 'raddus', name: 'Admiral Raddus', color: '#0088ff', hp: 150, weapon: 'blaster', ability: 'rally', bio: 'Mon Calamari admiral who led the Rogue One mission. Sacrificed himself at Scarif.' },
                    { id: 'holdo', name: 'Vice Admiral Holdo', color: '#ff66cc', hp: 145, weapon: 'blaster', ability: 'rally', bio: 'Brave leader who made the ultimate sacrifice. Her hyperspace ram will never be forgotten.' },
                    { id: 'rose', name: 'Rose Tico', color: '#ff9966', hp: 130, weapon: 'blaster', ability: 'thermal_detonator', bio: 'Resistance mechanic who found her courage. "Not fighting what we hate, saving what we love."' },
                    { id: 'zorii', name: 'Zorii Bliss', color: '#666699', hp: 140, weapon: 'blaster', ability: 'stealth', bio: 'Leader of the Spice Runners of Kijimi. Former associate of Poe Dameron.' },
                    { id: 'jannah', name: 'Jannah', color: '#00cc99', hp: 145, weapon: 'blaster', ability: 'sniper_shot', bio: 'Former First Order stormtrooper who defected. Skilled with heavy weapons.' },
                    { id: 'qira', name: 'Qi\'ra', color: '#996633', hp: 135, weapon: 'blaster', ability: 'stealth', bio: 'Han Solo\'s first love from Corellia. Rose from slavery to lead the Crimson Dawn.' },
                    { id: 'enfys', name: 'Enfys Nest', color: '#663333', hp: 140, weapon: 'staff', ability: 'double_blade', bio: 'Leader of the Cloud-Riders. Fights for the oppressed with fierce determination.' },

                    // --- BAD BATCH ---
                    { id: 'hunter', name: 'Hunter', color: '#555555', hp: 165, weapon: 'blaster', ability: 'sniper_shot', bio: 'Leader of the Bad Batch with enhanced senses. Skilled tracker and tactician.' },
                    { id: 'wrecker', name: 'Wrecker', color: '#444444', hp: 200, weapon: 'blaster', ability: 'double_blade', bio: 'Heavy weapons specialist of the Bad Batch. Loves explosions and big guns.' },
                    { id: 'tech', name: 'Tech', color: '#777777', hp: 145, weapon: 'blaster', ability: 'shield_overload', bio: 'Genius strategist and tech expert of the Bad Batch. Can hack any system.' },
                    { id: 'echo', name: 'Echo', color: '#666666', hp: 150, weapon: 'blaster', ability: 'rocket_barrage', bio: 'Cybernetically-enhanced soldier. Former ARC trooper who survived the Citadel.' },
                    { id: 'crosshair', name: 'Crosshair', color: '#333333', hp: 150, weapon: 'blaster', ability: 'sniper_shot', bio: 'Sharpshooter with genetic modifications for precision. Loyal to the Empire.' },

                    // --- DROIDS & OTHERS ---
                    { id: 'babu', name: 'Babu Frik', color: '#d9b38c', hp: 110, weapon: 'wrench', ability: 'ion_blast', bio: 'Droidsmith from Kijimi who helped reprogram droids. Small but skilled technician.' },
                    { id: 'r2d2', name: 'R2-D2', color: '#a8f0ff', hp: 125, weapon: 'zap', isDroid: true, ability: 'ion_blast', bio: 'Astromech droid who served the Jedi and the Rebellion. Brave and resourceful companion.' },
                    { id: 'c3po', name: 'C-3PO', color: '#ffd700', hp: 120, weapon: 'zap', isDroid: true, ability: 'ion_blast', bio: 'Protocol droid fluent in over six million forms of communication. Loyal but anxious.' },
                    { id: 'bb8', name: 'BB-8', color: '#ff8c42', hp: 115, weapon: 'zap', isDroid: true, ability: 'ion_blast', bio: 'Astromech droid who served Poe Dameron. Cheerful and brave companion.' },
                    { id: 'ig11', name: 'IG-11', color: '#bbbbbb', hp: 150, weapon: 'blaster', isDroid: true, ability: 'rocket_barrage', bio: 'Bounty hunter droid reprogrammed to protect. Self-destructed to save his friends.' }
                ],
                villains: [
                    // --- SITH & DARK SIDE ---
                    { id: 'vader', name: 'Darth Vader', color: '#ff0000', hp: 280, weapon: 'lightsaber', saberColor: '#ff2200', ability: 'force_choke', bio: 'Once the Chosen One. Now the Emperor\'s enforcer. His breathing alone inspires fear.' },
                    { id: 'darth_vader', name: 'Darth Vader (Elite)', color: '#cc0000', hp: 300, weapon: 'lightsaber', saberColor: '#ff0000', weaponDamage: 28, ability: 'force_choke', unlockAchievement: 'vaderConquest', bio: 'His full power is unleashed only through conquest. Ten consecutive victories prove his dominance.' },
                    { id: 'palpatine', name: 'The Emperor', color: '#ff0000', hp: 245, weapon: 'zap', ability: 'chain_lightning', bio: 'Sheev Palpatine — 1000 years of Sith planning in one sinister body.' },
                    { id: 'maul', name: 'Darth Maul', color: '#ff0000', hp: 210, weapon: 'lightsaber', saberColor: '#ff2200', ability: 'double_blade', bio: 'Zabrak Sith assassin. Cut in half. Came back angrier. Double-bladed and deadly.' },
                    { id: 'darth_maul', name: 'Darth Maul (Elite)', color: '#cc0000', hp: 220, weapon: 'lightsaber', saberColor: '#ff0000', weaponDamage: 20, ability: 'double_blade', unlockAchievement: 'speedDemon', bio: 'His full power is unlocked only for the fastest warriors.' },
                    { id: 'kylo', name: 'Kylo Ren', color: '#d60000', hp: 215, weapon: 'lightsaber', saberColor: '#ff3300', ability: 'force_push', bio: 'Ben Solo turned villain. His crossguard saber crackles with raw, unstable power.' },
                    { id: 'dooku', name: 'Count Dooku', color: '#ff0000', hp: 200, weapon: 'lightsaber', saberColor: '#ff2200', ability: 'chain_lightning', bio: 'Fallen Jedi, Separatist leader. His curved hilt is as elegant as his deception.' },
                    { id: 'ventress', name: 'Asajj Ventress', color: '#ff3333', hp: 175, weapon: 'lightsaber', saberColor: '#ff4444', ability: 'double_blade', bio: 'Dooku\'s assassin and former Nightsister. Betrayed by everyone — feared by all.' },
                    { id: 'savage', name: 'Savage Opress', color: '#ffff00', hp: 225, weapon: 'lightsaber', saberColor: '#ff2200', ability: 'force_push', bio: 'Maul\'s brother. Enhanced by Nightsister magic into a warrior of savage fury.' },
                    { id: 'revan', name: 'Darth Revan', color: '#800080', hp: 250, weapon: 'lightsaber', saberColor: '#800080', ability: 'force_push', bio: 'Jedi turned Sith Lord turned Jedi again. The most complex warrior in the galaxy.' },
                    { id: 'malak', name: 'Darth Malak', color: '#ff0000', hp: 240, weapon: 'lightsaber', saberColor: '#ff0000', ability: 'force_push', bio: 'Revan\'s apprentice who betrayed his master and conquered the galaxy in his place.' },
                    { id: 'nihilus', name: 'Darth Nihilus', color: '#222222', hp: 245, weapon: 'lightsaber', saberColor: '#ff0000', ability: 'force_choke', bio: 'A wound in the Force itself. He drains life from entire planets to sustain himself.' },
                    { id: 'snoke', name: 'Supreme Leader Snoke', color: '#ffccaa', hp: 200, weapon: 'zap', ability: 'chain_lightning', bio: 'Puppet master of the First Order. More powerful — and more disposable — than he knew.' },

                    // --- INQUISITORS ---
                    { id: 'inquisitor', name: 'Grand Inquisitor', color: '#ff0000', hp: 175, weapon: 'lightsaber', saberColor: '#ff2200', ability: 'force_push', bio: 'Leader of the Inquisitorius hunting Jedi survivors. Former Jedi Temple Guard turned to the dark side.' },
                    { id: 'secondsister', name: 'Second Sister', color: '#ff0000', hp: 190, weapon: 'lightsaber', saberColor: '#ff2200', ability: 'force_push', bio: 'Trilla Suduri — fierce Inquisitor who hunted Cal Kestis. Former Padawan of Cere Junda.' },
                    { id: 'ninthsister', name: 'Ninth Sister', color: '#ff0000', hp: 220, weapon: 'lightsaber', saberColor: '#ff2200', ability: 'force_push', bio: 'Masana Tide — large and powerful Inquisitor. Uses her size and strength to overwhelm opponents.' },

                    // --- BOUNTY HUNTERS & SCUM ---
                    { id: 'boba', name: 'Boba Fett', color: '#00ff00', hp: 160, weapon: 'blaster', ability: 'jetpack', bio: 'Clone of Jango Fett. Survived the Sarlacc. Now rules Tatooine from Jabba\'s throne.' },
                    { id: 'jango', name: 'Jango Fett', color: '#0077ff', hp: 155, weapon: 'blaster', ability: 'jetpack', bio: 'The template for the entire clone army. Died at Geonosis without breaking a sweat.' },
                    { id: 'jango_fett', name: 'Jango Fett (Elite)', color: '#0066cc', hp: 165, weapon: 'blaster', weaponDamage: 28, ability: 'jetpack', unlockAchievement: 'comboMaster', bio: 'His full arsenal is unlocked for those who master rapid eliminations.' },
                    { id: 'cadbane', name: 'Cad Bane', color: '#b000ff', hp: 150, weapon: 'blaster', ability: 'sniper_shot', bio: 'The galaxy\'s most feared bounty hunter before Boba rose. Fast draw, cold heart.' },
                    { id: 'bossk', name: 'Bossk', color: '#ffaa00', hp: 180, weapon: 'bowcaster', ability: 'thermal_detonator', bio: 'Trandoshan hunter with a deep hatred of Wookiees. Deadly and utterly ruthless.' },
                    { id: 'dengar', name: 'Dengar', color: '#aaaaaa', hp: 160, weapon: 'blaster', ability: 'sniper_shot', bio: 'Battered bounty hunter with a personal grudge against Han Solo.' },
                    { id: 'ig88', name: 'IG-88', color: '#888888', hp: 165, weapon: 'blaster', isDroid: true, ability: 'rocket_barrage', bio: 'An assassin droid who hunts for profit with machine-cold precision.' },
                    { id: 'aurrasing', name: 'Aurra Sing', color: '#ff5500', hp: 155, weapon: 'bowcaster', ability: 'sniper_shot', bio: 'Former Jedi Padawan turned deadly sniper. Ruthless and precise.' },
                    { id: 'embo', name: 'Embo', color: '#00aa00', hp: 170, weapon: 'bowcaster', ability: 'sniper_shot', bio: 'Kyuzo bounty hunter. Throws his hat like a boomerang and catches it on the way back.' },

                    // --- IMPERIAL LEADERS & GUARDS ---
                    { id: 'thrawn', name: 'Admiral Thrawn', color: '#0077ff', hp: 145, weapon: 'blaster', ability: 'rally', bio: 'Brilliant Chiss tactician. Studied art to understand his enemies.' },
                    { id: 'gideon', name: 'Moff Gideon', color: '#ff0000', hp: 130, weapon: 'darksaber', saberColor: '#000000', ability: 'jetpack', bio: 'Imperial warlord seeking to restore the Empire. Wields the stolen Darksaber.' },
                    { id: 'tarkin', name: 'Grand Moff Tarkin', color: '#aaaaaa', hp: 120, weapon: 'blaster', ability: 'rally', bio: 'Governor of the Outer Rim. Ordered the destruction of Alderaan without hesitation.' },
                    { id: 'krennic', name: 'Director Krennic', color: '#ffffff', hp: 130, weapon: 'blaster', ability: 'rally', bio: 'Director of the Death Star project. Ambitious and ruthless.' },
                    { id: 'yularen', name: 'Admiral Yularen', color: '#0066ff', hp: 115, weapon: 'blaster', ability: 'rally', bio: 'ISB officer who served in both the Republic and Empire. Loyal and efficient.' },
                    { id: 'konstantine', name: 'Adm. Konstantine', color: '#666666', hp: 110, weapon: 'blaster', ability: 'rally', bio: 'Imperial admiral who served under Thrawn. Questioned his unconventional tactics.' },
                    { id: 'sloane', name: 'Grand Admiral Sloane', color: '#ff6666', hp: 135, weapon: 'blaster', ability: 'rally', bio: 'Rising star in the Imperial Navy. Competent and ambitious officer.' },
                    { id: 'royalguard', name: 'Royal Guard', color: '#ff0000', hp: 150, weapon: 'staff', ability: 'double_blade', bio: 'Elite red-robed guards who protect the Emperor.' },
                    { id: 'praetorian', name: 'Praetorian Guard', color: '#ff0000', hp: 160, weapon: 'staff', ability: 'double_blade', bio: 'Elite guards of Supreme Leader Snoke. Deadly in melee combat.' },
                    { id: 'phasma', name: 'Captain Phasma', color: '#cccccc', hp: 165, weapon: 'blaster', ability: 'rally', bio: 'Chrome-armored captain of the First Order. Trained Finn and other stormtroopers.' },
                    { id: 'hux', name: 'General Hux', color: '#222222', hp: 120, weapon: 'blaster', ability: 'rally', bio: 'Arrogant general of the First Order. Desperate to prove himself to Supreme Leader Snoke.' },

                    // --- TROOPERS & SEPARATISTS ---
                    { id: 'stormtrooper', name: 'Stormtrooper', color: '#ffffff', hp: 80, weapon: 'blaster', ability: 'rally', bio: 'The backbone of the Imperial military. Accurate shots... supposedly.' },
                    { id: 'deathtrooper', name: 'Death Trooper', color: '#444444', hp: 115, weapon: 'blaster', ability: 'sniper_shot', bio: 'Elite special forces stormtroopers. Terrifying and deadly.' },
                    { id: 'scouttrooper', name: 'Scout Trooper', color: '#ffffff', hp: 85, weapon: 'blaster', ability: 'sniper_shot', bio: 'Light reconnaissance trooper. Skilled with speeder bikes and long-range weapons.' },
                    { id: 'snowtrooper', name: 'Snowtrooper', color: '#dddddd', hp: 90, weapon: 'blaster', ability: 'rally', bio: 'Cold assault trooper trained for frozen environments like Hoth.' },
                    { id: 'sithtrooper', name: 'Sith Trooper', color: '#ff0000', hp: 100, weapon: 'blaster', ability: 'rally', bio: 'Elite soldiers of the Final Order. Fanatically loyal to the Sith Eternal.' },
                    { id: 'grievous', name: 'Gen. Grievous', color: '#00ffcc', hp: 265, weapon: 'lightsaber', saberColor: '#44ff88', weaponDamage: 72, ability: 'double_blade', bio: 'Kaleesh cyborg supreme commander. Hunted Jedi for sport and collected their lightsabers.' },
                    { id: 'b1droid', name: 'B1 Battle Droid', color: '#b6b6b6', hp: 90, weapon: 'zap', isDroid: true, ability: 'ion_blast', bio: 'Mass-produced battle droid of the Separatist Alliance. Weak in numbers, strong in numbers.' },
                    { id: 'superdroid', name: 'Super Battle Droid', color: '#7f7f7f', hp: 130, weapon: 'zap', isDroid: true, ability: 'ion_blast', bio: 'Heavier version of the B1. More durable and dangerous.' },
                    { id: 'droideka', name: 'Droideka', color: '#4fd1c5', hp: 170, weapon: 'zap', isDroid: true, ability: 'ion_blast', bio: 'Destroyer droid with shield generator. Can roll into a ball for rapid deployment.' },
                    { id: 'magnaguard', name: 'MagnaGuard', color: '#9cf542', hp: 160, weapon: 'staff', isDroid: true, ability: 'double_blade', bio: 'Grievous\'s elite droid bodyguards. Skilled in melee combat.' },
                    { id: 'bxcommando', name: 'BX Commando Droid', color: '#444444', hp: 130, weapon: 'staff', isDroid: true, ability: 'double_blade', bio: 'Elite commando droids used by the Separatists for special operations.' },
                    { id: 'darktrooper', name: 'Dark Trooper', color: '#111111', hp: 180, weapon: 'blaster', isDroid: true, ability: 'rocket_barrage', bio: 'Imperial battle droid project. Phase III dark troopers are nearly unstoppable.' },
                    { id: 'hk47', name: 'HK-47', color: '#ff5555', hp: 140, weapon: 'blaster', isDroid: true, ability: 'rocket_barrage', bio: 'Assassin droid from the Old Republic era. "Meatbag" is his favorite insult.' },
                    { id: 'greedo', name: 'Greedo', color: '#00ff00', hp: 85, weapon: 'blaster', ability: 'sniper_shot', bio: 'Rodian bounty hunter who tried to collect on Han Solo. Shot first... or did he?' },
                    { id: '4lom', name: '4-LOM', color: '#888888', hp: 130, weapon: 'blaster', isDroid: true, ability: 'sniper_shot', bio: 'Protocol droid turned bounty hunter. Partnered with Zuckuss.' },
                    { id: 'zuckuss', name: 'Zuckuss', color: '#666666', hp: 140, weapon: 'blaster', ability: 'sniper_shot', bio: 'Gand findsman and bounty hunter. Uses mystical traditions to track targets.' },
                    { id: 'fennec', name: 'Fennec Shand', color: '#ff9966', hp: 145, weapon: 'blaster', ability: 'sniper_shot', bio: 'Elite mercenary and assassin. Partner of Boba Fett on Tatooine.' },
                    { id: 'hondo', name: 'Hondo Ohnaka', color: '#ff6600', hp: 125, weapon: 'blaster', ability: 'stealth', bio: 'Pirate leader with a heart of gold... sometimes. "We are only in this for the money."' },
                    { id: 'xizor', name: 'Prince Xizor', color: '#00ff00', hp: 155, weapon: 'blaster', ability: 'stealth', bio: 'Leader of Black Sun and rival to Vader. One of the most powerful crime lords in the galaxy.' },
                    { id: 'jabbathehutt', name: 'Jabba the Hutt', color: '#00cc00', hp: 280, weapon: 'blaster', ability: 'thermal_detonator', bio: 'Crime lord of Tatooine. Powerful, ruthless, and surrounded by minions.' },
                    { id: 'ren', name: 'Kylo Ren', color: '#d60000', hp: 215, weapon: 'lightsaber', saberColor: '#ff3300', ability: 'force_push', bio: 'Ben Solo turned villain. His crossguard saber crackles with raw, unstable power.' },
                    { id: 'knightsren', name: 'Knights of Ren', color: '#990000', hp: 180, weapon: 'lightsaber', saberColor: '#ff2200', ability: 'double_blade', bio: 'Elite warriors who serve Kylo Ren. Deadly and mysterious.' },
                    { id: 'jet', name: 'Jet Trooper', color: '#0066ff', hp: 95, weapon: 'blaster', ability: 'jetpack', bio: 'First Order aerial assault trooper. Equipped with jetpacks for vertical engagement.' },
                    { id: 'firstorder', name: 'FO Officer', color: '#222222', hp: 90, weapon: 'blaster', ability: 'rally', bio: 'Officer in the First Order military. Ruthless and disciplined.' }
                ],
                secret: [
                    { id: 'ultimate_palp', name: 'Ultimate Palpatine', color: '#9900ff', hp: 180, weapon: 'lightning', saberColor: '#9900ff', isDroid: false, secretUnlock: 'secretFaction', ability: 'chain_lightning', bio: 'The Emperor at his full power. Unleashed only when the secret faction is revealed.' },
                    { id: 'burnt_anakin', name: 'Burnt Anakin', color: '#ff4400', hp: 160, weapon: 'darksaber', saberColor: '#ff2200', isDroid: false, secretUnlock: 'burntAnakin', ability: 'force_push', bio: 'Anakin Skywalker after his defeat on Mustafar. Scarred and broken, but still powerful.' },
                    { id: 'senator_palpatine', name: 'Senator Palpatine', color: '#c8a84b', hp: 95, weapon: 'blaster', isDroid: false, secretUnlock: 'senatorPalpatine', ability: 'rally', bio: 'The Chancellor before revealing his true identity. Deceptively mild-mannered.' },
                    { id: 'jabba', name: 'Jabba the Hutt', color: '#a67a1c', hp: 260, weapon: 'blaster', isDroid: false, secretUnlock: 'jabbaUnlock', ability: 'thermal_detonator', bio: 'Crime lord of Tatooine. Massive, wealthy, and utterly ruthless.' },
                    { id: 'tarfful', name: 'Tarfful', color: '#8b7355', hp: 225, weapon: 'bowcaster', isWookiee: true, secretUnlock: 'tarffulUnlock', ability: 'double_blade', bio: 'Wookiee chieftain and longtime friend of Chewbacca. Fiercer and stronger than most Wookiees.' },
                    { id: 'cousin_crew', name: 'Cousin Crew', color: '#808080', hp: 500, weapon: 'computer', isDroid: false, secretUnlock: 'devTeam', ability: 'ion_blast', bio: 'The developers themselves. Unlocked only by those who know the secret ways.' }
                ],
                unplayable: [
                    { id: 'carbonite_han', name: 'Carbonite Han', color: '#888888', hp: 180, weapon: 'blaster', isFrozen: true, bio: 'Han Solo frozen in carbonite. A trophy for Jabba\'s palace.' },
                    { id: 'sith_c3po', name: 'Sith C-3PO', color: '#ffd700', hp: 320, weapon: 'zap', isDroid: true, weaponDamage: 24, bio: 'C-3PO corrupted by dark protocols. A nightmare version of the beloved droid.' }
                ]
            };

            // Build Menus
            let mobilePreviewState = { active: false, char: null, btn: null };
            
            // Favorites management
            let favorites = new Set();
            
            function loadFavorites() {
                try {
                    const saved = localStorage.getItem('galacticDuelFavorites');
                    if (saved) {
                        favorites = new Set(JSON.parse(saved));
                    }
                } catch(err) {}
            }
            
            function saveFavorites() {
                try {
                    localStorage.setItem('galacticDuelFavorites', JSON.stringify([...favorites]));
                } catch(err) {}
            }
            
            function toggleFavorite(charId) {
                if (favorites.has(charId)) {
                    favorites.delete(charId);
                } else {
                    favorites.add(charId);
                }
                saveFavorites();
                rebuildAllRosters();
            }
            
            function isFavorite(charId) {
                return favorites.has(charId);
            }
            
            loadFavorites();
            
            function isMobileView() {
                return window.innerWidth < 700;
            }
            
            function makeRosterButton(char, cssClass, clickFn) {
                const btn = document.createElement('button');
                btn.className = cssClass;
                btn.dataset.character = char.id;
                const em = weaponEmoji[char.weapon] || '⚔️';
                btn.innerHTML = `<span style="margin-right:5px;font-size:0.9em">${em}</span>${char.name}`;
                btn.style.borderLeftColor = char.color;
                btn.style.borderLeftWidth = '3px';
                
                // Add star button
                const starBtn = document.createElement('button');
                starBtn.className = 'star-btn';
                starBtn.innerHTML = '☆';
                starBtn.title = 'Toggle favorite';
                if (isFavorite(char.id)) {
                    starBtn.classList.add('favorited');
                    starBtn.innerHTML = '★';
                }
                starBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    toggleFavorite(char.id);
                });
                btn.appendChild(starBtn);
                
                if (isMobileView()) {
                    // Mobile: tap-once-to-preview, tap-again-to-confirm
                    btn.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        
                        if (mobilePreviewState.active && mobilePreviewState.char === char) {
                            // Second tap on same button: confirm selection
                            hideStatCard();
                            mobilePreviewState.active = false;
                            mobilePreviewState.char = null;
                            mobilePreviewState.btn = null;
                            clickFn();
                        } else {
                            // First tap: show preview
                            if (mobilePreviewState.btn) {
                                mobilePreviewState.btn.style.borderColor = '';
                                mobilePreviewState.btn.style.filter = '';
                            }
                            mobilePreviewState.active = true;
                            mobilePreviewState.char = char;
                            mobilePreviewState.btn = btn;
                            showStatCard(char, btn);
                            btn.style.borderColor = '#00A4FF';
                            btn.style.filter = 'brightness(1.3)';
                        }
                    });
                } else {
                    // Desktop: hover behavior
                    btn.addEventListener('click', clickFn);
                    btn.addEventListener('mouseenter', () => showStatCard(char, btn));
                    btn.addEventListener('mouseleave', hideStatCard);
                }
                
                return btn;
            }

            function makeLockedHintButton(char, cssClass) {
                const btn = document.createElement('button');
                btn.className = cssClass;
                btn.style.opacity = '0.4';
                btn.style.cursor = 'help';
                btn.innerHTML = '???';
                btn.style.borderLeftColor = '#666666';
                btn.style.borderLeftWidth = '3px';
                
                if (isMobileView()) {
                    btn.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (mobilePreviewState.btn) {
                            mobilePreviewState.btn.style.borderColor = '';
                            mobilePreviewState.btn.style.filter = '';
                        }
                        mobilePreviewState.active = true;
                        mobilePreviewState.char = char;
                        mobilePreviewState.btn = btn;
                        showStatCard(char, btn, true);
                        btn.style.borderColor = '#00A4FF';
                        btn.style.filter = 'brightness(1.3)';
                    });
                } else {
                    btn.addEventListener('mouseenter', () => showStatCard(char, btn, true));
                    btn.addEventListener('mouseleave', hideStatCard);
                }
                
                return btn;
            }

            const heroContainer = document.getElementById('hero-roster');
            const villainContainer = document.getElementById('villain-roster');
            const searchInput = document.getElementById('searchInput');

            function rebuildHeroRoster() {
                heroContainer.innerHTML = '';
                const searchTerm = searchInput.value.toLowerCase();
                
                let sortedHeroes = [...characters.heroes];
                // Sort: favorites first, then alphabetically
                sortedHeroes.sort((a, b) => {
                    const aFav = isFavorite(a.id);
                    const bFav = isFavorite(b.id);
                    if (aFav && !bFav) return -1;
                    if (!aFav && bFav) return 1;
                    return a.name.localeCompare(b.name);
                });
                
                sortedHeroes.forEach(char => {
                    if (searchTerm && !char.name.toLowerCase().includes(searchTerm)) return;
                    
                    if (char.unlockAchievement && !achievements[char.unlockAchievement]?.done) {
                        heroContainer.appendChild(makeLockedHintButton(char, 'game-button hero-button'));
                    } else {
                        heroContainer.appendChild(makeRosterButton(char, 'game-button hero-button', () => showOpponentPicker(char.id)));
                    }
                });
            }

            function rebuildVillainRoster() {
                villainContainer.innerHTML = '';
                const searchTerm = searchInput.value.toLowerCase();
                
                let sortedVillains = [...characters.villains];
                // Sort: favorites first, then alphabetically
                sortedVillains.sort((a, b) => {
                    const aFav = isFavorite(a.id);
                    const bFav = isFavorite(b.id);
                    if (aFav && !bFav) return -1;
                    if (!aFav && bFav) return 1;
                    return a.name.localeCompare(b.name);
                });
                
                sortedVillains.forEach(char => {
                    if (searchTerm && !char.name.toLowerCase().includes(searchTerm)) return;
                    
                    if (char.unlockAchievement && !achievements[char.unlockAchievement]?.done) {
                        villainContainer.appendChild(makeLockedHintButton(char, 'game-button villain-button'));
                    } else {
                        villainContainer.appendChild(makeRosterButton(char, 'game-button villain-button', () => showOpponentPicker(char.id)));
                    }
                });
            }

            function rebuildSecretRoster() {
                secretContainer.innerHTML = '';
                const searchTerm = searchInput.value.toLowerCase();
                
                if (!gameUnlocks.secretFaction && !gameUnlocks.burntAnakin && !gameUnlocks.senatorPalpatine && !gameUnlocks.devTeam && !gameUnlocks.tarffulUnlock) return;
                
                let sortedSecret = [...characters.secret];
                // Sort: favorites first, then alphabetically
                sortedSecret.sort((a, b) => {
                    const aFav = isFavorite(a.id);
                    const bFav = isFavorite(b.id);
                    if (aFav && !bFav) return -1;
                    if (!aFav && bFav) return 1;
                    return a.name.localeCompare(b.name);
                });
                
                sortedSecret.forEach(char => {
                    if (searchTerm && !char.name.toLowerCase().includes(searchTerm)) return;
                    
                    if (char.id === 'ultimate_palp' && !gameUnlocks.secretFaction) return;
                    if (char.secretUnlock === 'burntAnakin' && !gameUnlocks.burntAnakin) return;
                    if (char.secretUnlock === 'senatorPalpatine' && !gameUnlocks.senatorPalpatine) return;
                    if (char.secretUnlock === 'devTeam' && !gameUnlocks.devTeam) return;
                    if (char.secretUnlock === 'tarffulUnlock' && !gameUnlocks.tarffulUnlock) return;
                    secretContainer.appendChild(makeRosterButton(char, 'game-button secret-button', () => showOpponentPicker(char.id)));
                });
            }

            function rebuildAllRosters() {
                rebuildHeroRoster();
                rebuildVillainRoster();
                rebuildSecretRoster();
            }

            rebuildHeroRoster();
            rebuildVillainRoster();

            // Search functionality
            searchInput.addEventListener('input', rebuildAllRosters);

            const secretContainer = document.getElementById('secret-roster');

            loadGalacticUnlocks();
            rebuildSecretRoster();

            const devMenuToggle = document.getElementById('devMenuToggle');
            const devMenuPanel = document.getElementById('devMenuPanel');

            function isDevMenuHost() {
                const h = (location.hostname || '').toLowerCase();
                if (h.endsWith('itch.io') || h.endsWith('itch.zone')) return false;
                return h === 'localhost' || h === '127.0.0.1' || h === '[::1]' || h === '' || location.protocol === 'file:';
            }

            if (isDevMenuHost()) {
                devMenuToggle.classList.add('is-visible');
            }

            devMenuToggle.addEventListener('click', (e) => {
                e.stopPropagation();
                const open = devMenuPanel.style.display !== 'block';
                devMenuPanel.style.display = open ? 'block' : 'none';
                devMenuToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
            });

            // Secret faction collapsible toggle
            const secretFactionToggle = document.getElementById('secret-faction-toggle');
            const secretCollapseWrapper = document.querySelector('.secret-collapse-wrapper');
            const secretChevron = document.getElementById('secret-faction-chevron');
            
            if (secretFactionToggle && secretCollapseWrapper && secretChevron) {
                secretFactionToggle.addEventListener('click', () => {
                    secretCollapseWrapper.classList.toggle('collapsed');
                    const isCollapsed = secretCollapseWrapper.classList.contains('collapsed');
                    secretChevron.textContent = isCollapsed ? '▶' : '▼';
                });
            }

            document.addEventListener('click', (e) => {
                if (!isDevMenuHost() || devMenuPanel.style.display !== 'block') return;
                if (e.target === devMenuToggle || devMenuToggle.contains(e.target)) return;
                if (devMenuPanel.contains(e.target)) return;
                devMenuPanel.style.display = 'none';
                devMenuToggle.setAttribute('aria-expanded', 'false');
            });

            document.getElementById('devUnlockAchievements').addEventListener('click', () => {
                Object.keys(achievements).forEach(id => { achievements[id].done = true; });
                try {
                    const saved = {};
                    Object.keys(achievements).forEach(id => { saved[id] = true; });
                    localStorage.setItem('galacticDuelAchievements', JSON.stringify(saved));
                } catch(err) {}
                persistGalacticUnlocks();
                rebuildHeroRoster();
                rebuildVillainRoster();
                showAnnouncement('All achievements unlocked. Elite characters are now available!', '#ffd700', 4000, '🏆 DEV: ALL ACHIEVEMENTS');
            });
            document.getElementById('devToggleInvincibility').addEventListener('click', () => {
                invincibilityEnabled = !invincibilityEnabled;
                document.getElementById('devToggleInvincibility').textContent = `Invincibility: ${invincibilityEnabled ? 'ON' : 'OFF'}`;
            });
            document.getElementById('devUnlockAllSecrets').addEventListener('click', () => {
                gameUnlocks.secretFaction = true;
                gameUnlocks.burntAnakin = true;
                gameUnlocks.tatooineArena = true;
                gameUnlocks.senatorPalpatine = true;
                gameUnlocks.devTeam = true;
                gameUnlocks.tarffulUnlock = true;
                persistGalacticUnlocks();
                rebuildSecretRoster();
                updateSecretFactionSectionVisibility();
                // Show Tatooine arena button
                const btn = document.getElementById('tatooineArenaBtn');
                if (btn) btn.style.display = 'inline-block';
                showAnnouncement('All secrets are now unlocked!', '#ff00ff', 3500, '🔓 DEV: ALL SECRETS');
            });

            // Dev menu credits slider
            const devCreditsSlider = document.getElementById('devCreditsSlider');
            const devCreditsValue = document.getElementById('devCreditsValue');
            devCreditsSlider.value = credits;
            devCreditsValue.textContent = credits;
            devCreditsSlider.addEventListener('input', (e) => {
                credits = parseInt(e.target.value);
                devCreditsValue.textContent = credits;
                saveGameSettings();
                updateCreditsDisplay();
            });

            // ── ROSTER DATA VALIDATION (dev menu) ──────────────────────
            function validateRosterData() {
                const lines = [];
                const seenIds = new Map(); // id -> faction it was first seen in
                let errorCount = 0, warningCount = 0;
                let totalChars = 0;

                const requiredFields = ['id', 'name', 'color', 'hp', 'weapon'];

                Object.keys(characters).forEach(faction => {
                    const roster = characters[faction];
                    if (!Array.isArray(roster)) return;
                    roster.forEach((char, idx) => {
                        totalChars++;
                        const label = char && char.name ? `"${char.name}"` : `entry #${idx + 1}`;
                        const tag = char && char.id ? char.id : `${faction}[${idx}]`;

                        // Required fields
                        requiredFields.forEach(field => {
                            const val = char ? char[field] : undefined;
                            if (val === undefined || val === null || val === '') {
                                lines.push({ type: 'error', text: `[${faction}] ${label} (${tag}) — missing required field "${field}"` });
                                errorCount++;
                            }
                        });

                        // hp should be a positive number
                        if (char && char.hp !== undefined && (typeof char.hp !== 'number' || char.hp <= 0)) {
                            lines.push({ type: 'error', text: `[${faction}] ${label} (${tag}) — "hp" should be a positive number, got ${JSON.stringify(char.hp)}` });
                            errorCount++;
                        }

                        // Duplicate id check
                        if (char && char.id) {
                            if (seenIds.has(char.id)) {
                                lines.push({ type: 'error', text: `Duplicate id "${char.id}" — also used by ${seenIds.get(char.id)}` });
                                errorCount++;
                            } else {
                                seenIds.set(char.id, `[${faction}] ${label}`);
                            }
                        }

                        // Weapon must exist in WEAPON_LIBRARY
                        if (char && char.weapon && !WEAPON_LIBRARY[char.weapon]) {
                            lines.push({ type: 'error', text: `[${faction}] ${label} (${tag}) — unknown weapon "${char.weapon}" (no entry in WEAPON_LIBRARY)` });
                            errorCount++;
                        }

                        // unlockAchievement must reference a real achievement
                        if (char && char.unlockAchievement && !achievements[char.unlockAchievement]) {
                            lines.push({ type: 'error', text: `[${faction}] ${label} (${tag}) — unlockAchievement "${char.unlockAchievement}" does not match any achievement id` });
                            errorCount++;
                        }

                        // Lightsaber users without a saber color (cosmetic, non-blocking)
                        if (char && char.weapon === 'lightsaber' && !char.saberColor) {
                            lines.push({ type: 'warn', text: `[${faction}] ${label} (${tag}) — lightsaber user has no "saberColor" set` });
                            warningCount++;
                        }

                        // Missing bio (cosmetic, non-blocking)
                        if (char && !char.bio) {
                            lines.push({ type: 'warn', text: `[${faction}] ${label} (${tag}) — no "bio" set` });
                            warningCount++;
                        }
                    });
                });

                return { lines, errorCount, warningCount, totalChars };
            }

            document.getElementById('devValidateRoster').addEventListener('click', () => {
                const output = document.getElementById('devValidationOutput');
                const { lines, errorCount, warningCount, totalChars } = validateRosterData();

                const esc = (s) => String(s).replace(/[&<>]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;' }[c]));
                let html = `<span class="dv-heading">ROSTER VALIDATION — ${totalChars} characters checked</span>`;
                if (errorCount === 0 && warningCount === 0) {
                    html += `<span class="dv-ok">✓ No issues found.</span>`;
                } else {
                    if (errorCount > 0) {
                        html += `<span class="dv-heading">Errors (${errorCount})</span>`;
                        lines.filter(l => l.type === 'error').forEach(l => {
                            html += `<span class="dv-error">✗ ${esc(l.text)}</span>\n`;
                        });
                    }
                    if (warningCount > 0) {
                        html += `<span class="dv-heading">Warnings (${warningCount})</span>`;
                        lines.filter(l => l.type === 'warn').forEach(l => {
                            html += `<span class="dv-warn">⚠ ${esc(l.text)}</span>\n`;
                        });
                    }
                }
                output.innerHTML = html;
                output.style.display = 'block';

                if (errorCount > 0) {
                    showAnnouncement(`Roster validation found ${errorCount} error${errorCount === 1 ? '' : 's'}${warningCount ? ` and ${warningCount} warning${warningCount === 1 ? '' : 's'}` : ''}. See dev menu for details.`, '#ff6666', 5000, '🔍 DEV: VALIDATION');
                } else if (warningCount > 0) {
                    showAnnouncement(`Roster validation passed with ${warningCount} warning${warningCount === 1 ? '' : 's'}. See dev menu for details.`, '#ffcc55', 4000, '🔍 DEV: VALIDATION');
                } else {
                    showAnnouncement(`Roster validation passed — all ${totalChars} characters look good!`, '#44dd88', 3500, '🔍 DEV: VALIDATION');
                }
            });

            let gamePaused = false;

            let entities = [];
            let mainPlayer, mainEnemy, pCharData, eCharData;
            let bullets = [];
            let keys = {};
            let gameLoopId;
            let invincibilityEnabled = false;
            let lastGameFrameTime = 0;
            let clashParticles = [];
            let deathParticles = [];
            let floatNums = [];
            // Performance caps
            const MAX_HIT_SPARKS = 80;
            const MAX_IMPACT_PARTICLES = 140;
            const MAX_SABER_TRAILS = 60;
            const MAX_DEATH_PARTICLES = 80;
            const MAX_BULLETS = 200;
            const MAX_FLOATS = 60;

            // ── NEW VISUAL EFFECT SYSTEMS ─────────────────────────────
            let hitSparks = [];
            let impactParticles = [];
            let saberTrails = [];
            let screenShake = { intensity: 0, duration: 0 };
            let slowMotion = { active: false, scale: 1, duration: 0 };
            let killCamera = { active: false, target: null, zoom: 1, duration: 0 };
            let dodgeFlashes = [];
            let lowHealthVignette = false;

            // ── ARENA-SPECIFIC MECHANICS ───────────────────────────────
            let hothWindGustTimer = 0;
            let hothWindGustActive = false;
            let hothWindGustDirection = 0;
            let deathStarSuperlaserTimer = 0;
            let deathStarSuperlaserActive = false;
            let deathStarSuperlaserProgress = 0;
            let deathStarSuperlaserY = 0;
            let deathStarSuperlaserDamage = new Map(); // Track per-entity last damage time for superlaser

            // ── PICKUP SYSTEM ───────────────────────────────────────────
            let pickups = [];
            let pickupSpawnTimer = 0;
            const PICKUP_SPAWN_TIME = 15000; // 15 seconds
            const PICKUP_TYPES = ['health', 'shield', 'ammo'];

            // ── BOWCASTER CHARGE ──────────────────────────────────────
            let bowcasterCharging = false;
            let bowcasterCharge = 0;       // 0–1
            let bowcasterChargeStart = 0;
            const BOWCASTER_MAX_CHARGE_MS = 1500; // full charge in 1.5 s

            // ── COMPUTER CHARGE ──────────────────────────────────────
            let computerCharging = false;
            let computerCharge = 0;       // 0–1
            let computerChargeStart = 0;
            const COMPUTER_MAX_CHARGE_MS = 1500; // full charge in 1.5 s

            // ── SCREEN SHAKE ───────────────────────────────────────────
            function triggerScreenShake(intensity, duration) {
                screenShake.intensity = intensity;
                screenShake.duration = duration;
            }

            function updateScreenShake(tickScale) {
                if (screenShake.duration > 0) {
                    screenShake.duration -= tickScale;
                    if (screenShake.duration <= 0) {
                        screenShake.intensity = 0;
                    }
                }
            }

            function applyScreenShake() {
                if (screenShake.intensity > 0) {
                    const shakeX = (Math.random() - 0.5) * screenShake.intensity;
                    const shakeY = (Math.random() - 0.5) * screenShake.intensity;
                    ctx.translate(shakeX, shakeY);
                }
            }

            // ── HIT SPARKS ─────────────────────────────────────────────
            function spawnHitSparks(x, y, color, count = 12) {
                for (let i = 0; i < count; i++) {
                    const angle = Math.random() * Math.PI * 2;
                    const speed = Math.random() * 4 + 2;
                    if (hitSparks.length < MAX_HIT_SPARKS) {
                        hitSparks.push({
                            x, y,
                            dx: Math.cos(angle) * speed,
                            dy: Math.sin(angle) * speed,
                            life: 20 + Math.random() * 10,
                            maxLife: 30,
                            color,
                            size: Math.random() * 2 + 1
                        });
                    }
                }
            }

            function updateHitSparks(tickScale) {
                hitSparks = hitSparks.filter(p => {
                    p.x += p.dx * tickScale;
                    p.y += p.dy * tickScale;
                    p.dx *= 0.92;
                    p.dy *= 0.92;
                    p.life -= tickScale;
                    return p.life > 0;
                });
            }

            function drawHitSparks() {
                hitSparks.forEach(p => {
                    if (p.life <= 0) return;
                    ctx.save();
                    ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
                    ctx.fillStyle = p.color;
                    ctx.shadowBlur = 10;
                    ctx.shadowColor = p.color;
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, Math.max(0, p.size), 0, Math.PI * 2);
                    ctx.fill();
                    ctx.restore();
                });
            }

            // ── BLASTER IMPACT PARTICLES ───────────────────────────────
            function spawnImpactParticles(x, y, color, count = 8) {
                for (let i = 0; i < count; i++) {
                    const angle = Math.random() * Math.PI * 2;
                    const speed = Math.random() * 3 + 1;
                    if (impactParticles.length < MAX_IMPACT_PARTICLES) {
                        impactParticles.push({
                            x, y,
                            dx: Math.cos(angle) * speed,
                            dy: Math.sin(angle) * speed,
                            life: 15 + Math.random() * 8,
                            maxLife: 23,
                            color,
                            size: Math.random() * 3 + 2
                        });
                    }
                }
            }

            function updateImpactParticles(tickScale) {
                impactParticles = impactParticles.filter(p => {
                    p.x += p.dx * tickScale;
                    p.y += p.dy * tickScale;
                    p.dx *= 0.9;
                    p.dy *= 0.9;
                    p.life -= tickScale;
                    return p.life > 0;
                });
            }

            function drawImpactParticles() {
                impactParticles.forEach(p => {
                    if (p.life <= 0) return;
                    ctx.save();
                    ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
                    ctx.fillStyle = p.color;
                    ctx.shadowBlur = 8;
                    ctx.shadowColor = p.color;
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, Math.max(0, p.size * (p.life / p.maxLife)), 0, Math.PI * 2);
                    ctx.fill();
                    ctx.restore();
                });
            }

            // ── SABER TRAILS ───────────────────────────────────────────
            function addSaberTrailPoint(entity, target) {
                if (!entity || !target) return;
                const angle = Math.atan2(target.y - entity.y, target.x - entity.x);
                const reach = entity.weapon === 'lightsaber' ? 38 : entity.weapon === 'darksaber' ? 36 : entity.weapon === 'staff' ? 34 : 0;
                if (reach === 0) return;
                
                const startX = entity.x + Math.cos(angle) * CHARACTER_SIZE;
                const startY = entity.y + Math.sin(angle) * CHARACTER_SIZE;
                const endX = entity.x + Math.cos(angle) * (CHARACTER_SIZE + reach);
                const endY = entity.y + Math.sin(angle) * (CHARACTER_SIZE + reach);
                
                if (saberTrails.length < MAX_SABER_TRAILS) {
                    saberTrails.push({
                        startX, startY, endX, endY,
                        color: entity.saberColor || entity.color,
                        life: 8,
                        maxLife: 8,
                        width: entity.weapon === 'staff' ? 6 : 5
                    });
                }
            }

            function updateSaberTrails(tickScale) {
                saberTrails = saberTrails.filter(t => {
                    t.life -= tickScale;
                    return t.life > 0;
                });
            }

            function drawSaberTrails() {
                saberTrails.forEach(t => {
                    if (t.life <= 0) return;
                    ctx.save();
                    ctx.globalAlpha = Math.max(0, (t.life / t.maxLife) * 0.4);
                    ctx.lineCap = 'round';
                    ctx.strokeStyle = t.color;
                    ctx.lineWidth = Math.max(0, t.width * (t.life / t.maxLife));
                    ctx.shadowBlur = 12;
                    ctx.shadowColor = t.color;
                    ctx.beginPath();
                    ctx.moveTo(t.startX, t.startY);
                    ctx.lineTo(t.endX, t.endY);
                    ctx.stroke();
                    ctx.restore();
                });
            }

            // ── SLOW MOTION ───────────────────────────────────────────
            function triggerSlowMotion(scale, duration) {
                slowMotion.active = true;
                slowMotion.scale = scale;
                slowMotion.duration = duration;
            }

            function updateSlowMotion(dt) {
                if (slowMotion.active) {
                    slowMotion.duration -= dt;
                    if (slowMotion.duration <= 0) {
                        slowMotion.active = false;
                        slowMotion.scale = 1;
                    }
                }
            }

            // ── KILL CAMERA ────────────────────────────────────────────
            function triggerKillCamera(target) {
                killCamera.active = true;
                killCamera.target = target;
                killCamera.zoom = 1;
                killCamera.duration = 60;
            }

            function updateKillCamera(tickScale) {
                if (killCamera.active) {
                    killCamera.duration -= tickScale;
                    if (killCamera.zoom < 1.5) {
                        killCamera.zoom += 0.01 * tickScale;
                    }
                    if (killCamera.duration <= 0) {
                        killCamera.active = false;
                        killCamera.zoom = 1;
                    }
                }
            }

            function applyKillCamera() {
                if (killCamera.active && killCamera.target) {
                    const targetX = killCamera.target.x;
                    const targetY = killCamera.target.y;
                    ctx.translate(canvasLogicalW / 2, canvasLogicalH / 2);
                    ctx.scale(killCamera.zoom, killCamera.zoom);
                    ctx.translate(-targetX, -targetY);
                }
            }

            // ── DODGE FLASHES ─────────────────────────────────────────
            function spawnDodgeFlash(entity) {
                if (dodgeFlashes.length < 40) {
                    dodgeFlashes.push({
                        x: entity.x,
                        y: entity.y,
                        life: 10,
                        maxLife: 10,
                        color: entity.color
                    });
                }
            }

            function updateDodgeFlashes(tickScale) {
                dodgeFlashes = dodgeFlashes.filter(f => {
                    f.life -= tickScale;
                    return f.life > 0;
                });
            }

            function drawDodgeFlashes() {
                dodgeFlashes.forEach(f => {
                    ctx.save();
                    ctx.globalAlpha = (f.life / f.maxLife) * 0.6;
                    ctx.strokeStyle = f.color;
                    ctx.lineWidth = 3;
                    ctx.shadowBlur = 15;
                    ctx.shadowColor = f.color;
                    ctx.beginPath();
                    ctx.arc(f.x, f.y, CHARACTER_SIZE + 8, 0, Math.PI * 2);
                    ctx.stroke();
                    ctx.restore();
                });
            }

            // ── LOW HEALTH VIGNETTE ────────────────────────────────────
            function updateLowHealthVignette() {
                if (!mainPlayer) return;
                const healthPercent = mainPlayer.health / mainPlayer.maxHealth;
                lowHealthVignette = healthPercent < 0.3;
            }

            function drawLowHealthVignette() {
                if (!lowHealthVignette) return;
                const healthPercent = mainPlayer.health / mainPlayer.maxHealth;
                const intensity = (0.3 - healthPercent) / 0.3;
                
                ctx.save();
                ctx.globalAlpha = intensity * 0.4;
                const gradient = ctx.createRadialGradient(
                    canvasLogicalW / 2, canvasLogicalH / 2, 0,
                    canvasLogicalW / 2, canvasLogicalH / 2, Math.max(canvasLogicalW, canvasLogicalH) * 0.7
                );
                gradient.addColorStop(0, 'transparent');
                gradient.addColorStop(0.6, 'transparent');
                gradient.addColorStop(1, '#ff0000');
                ctx.fillStyle = gradient;
                ctx.fillRect(0, 0, canvasLogicalW, canvasLogicalH);
                ctx.restore();
            }

            // Difficulty button wiring
            document.querySelectorAll('.diff-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('selected'));
                    btn.classList.add('selected');
                    currentDifficulty = btn.dataset.diff;
                });
            });

            // Arena button wiring
            let currentArena = 'space';
            document.querySelectorAll('.arena-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    if (btn.id === 'randomArenaBtn') {
                        // Pick any visible real arena button (not the Random button itself)
                        const realBtns = [...document.querySelectorAll('.arena-btn')]
                            .filter(b => b.id !== 'randomArenaBtn' && b.style.display !== 'none');
                        if (!realBtns.length) return;
                        const pick = realBtns[Math.floor(Math.random() * realBtns.length)];
                        document.querySelectorAll('.arena-btn').forEach(b => b.classList.remove('selected'));
                        pick.classList.add('selected');
                        currentArena = pick.dataset.arena;
                        return;
                    }
                    document.querySelectorAll('.arena-btn').forEach(b => b.classList.remove('selected'));
                    btn.classList.add('selected');
                    currentArena = btn.dataset.arena;
                });
            });

            function getVisibleButtons(scope = document) {
                return Array.from(scope.querySelectorAll('button')).filter(btn => {
                    const style = window.getComputedStyle(btn);
                    return !btn.disabled && style.display !== 'none' && style.visibility !== 'hidden' && btn.offsetParent !== null;
                });
            }

            function focusFirstVisibleButton(scope = document) {
                const buttons = getVisibleButtons(scope);
                if (buttons.length > 0) {
                    buttons[0].focus();
                    return buttons[0];
                }
                return null;
            }

            function showSplashMenu() {
                splashMenu.style.display = 'flex';
                // restore dev/settings visibility when showing menus
                const devMenuToggleEl = document.getElementById('devMenuToggle');
                const settingsBtnEl = document.getElementById('settingsBtn');
                const fullscreenBtnEl = document.getElementById('fullscreenBtn');
                if (devMenuToggleEl && typeof isDevMenuHost === 'function' && isDevMenuHost()) { devMenuToggleEl.style.display = ''; devMenuToggleEl.classList.add('is-visible'); }
                if (settingsBtnEl) settingsBtnEl.style.display = '';
                if (fullscreenBtnEl) fullscreenBtnEl.style.display = fullscreenSupported ? '' : 'none';
                mainMenu.style.display = 'none';
                opponentMenu.style.display = 'none';
                messageOverlay.style.display = 'none';
                updateMobileControlsVisibility();
                setTimeout(() => focusFirstVisibleButton(splashMenu), 0);
            }

            function showMainMenu() {
                stopAllSfx();
                playMenuMusic();
                splashMenu.style.display = 'none';
                // restore dev/settings visibility when showing menus
                const devMenuToggleEl = document.getElementById('devMenuToggle');
                const settingsBtnEl = document.getElementById('settingsBtn');
                const fullscreenBtnEl = document.getElementById('fullscreenBtn');
                if (devMenuToggleEl && typeof isDevMenuHost === 'function' && isDevMenuHost()) { devMenuToggleEl.style.display = ''; devMenuToggleEl.classList.add('is-visible'); }
                if (settingsBtnEl) settingsBtnEl.style.display = '';
                if (fullscreenBtnEl) fullscreenBtnEl.style.display = fullscreenSupported ? '' : 'none';
                mainMenu.style.display = 'flex';
                opponentMenu.style.display = 'none';
                messageOverlay.style.display = 'none';
                updateMobileControlsVisibility();
                setTimeout(() => focusFirstVisibleButton(mainMenu), 0);
            }

            // --- ENTITY CLASSES & LOGIC ---

            class Character {
                constructor(x, y, color, name, maxHealth, weapon, saberColor, isDroid, isWookiee, team, isMainEntity, isClone, weaponDamage, characterId) {
                    this.x = x;
                    this.y = y;
                    this.color = color;
                    this.name = name;
                    this.maxHealth = maxHealth;
                    this.health = maxHealth;
                    this.isAlive = true;
                    this.weapon = weapon || 'blaster';
                    this.weaponConfig = getWeapon({ weapon: this.weapon, weaponDamage: weaponDamage });
                    this.saberColor = saberColor || color;
                    this.isDroid = !!isDroid;
                    this.isWookiee = !!isWookiee;
                    this.team = team;
                    this.isMainEntity = !!isMainEntity;
                    this.isClone = !!isClone;
                    this.characterId = characterId;

                    this.hasCalledBackup = false;
                    this.lastShotTime = 0;
                    this.stunnedUntil = 0;
                    this.knockedOutUntil = 0;
                    this.wasStunned = false;
                    this.wasKnockedOut = false;
                    this.zapImmunityUntil = 0;
                    this.wrenchImmunityUntil = 0;
                    this.vx = 0;
                    this.vy = 0;
                    this.hitFlashUntil = 0;
                    this.dodgeCooldown = 0;
                    this.isDodging = false;
                    this.dodgeEnd = 0;
                    
                    // Pickup effects
                    this.shieldActive = false;
                    this.shieldUntil = 0;
                    this.ammoBoostUntil = 0;
                    this.isFleeing = false;
                    this.hasFled = false;
                }

                draw(target) {
                    if (target) {
                        const angle = Math.atan2(target.y - this.y, target.x - this.x);
                        const reach = this.weapon === 'lightsaber' ? 38 : this.weapon === 'darksaber' ? 36 : this.weapon === 'staff' ? 34 : this.weapon === 'wrench' ? 26 : 0;

                        if (reach > 0) {
                            // Add saber trail point
                            addSaberTrailPoint(this, target);
                            
                            const startX = this.x + Math.cos(angle) * CHARACTER_SIZE;
                            const startY = this.y + Math.sin(angle) * CHARACTER_SIZE;
                            const endX = this.x + Math.cos(angle) * (CHARACTER_SIZE + reach);
                            const endY = this.y + Math.sin(angle) * (CHARACTER_SIZE + reach);
                            const glowColor = this.weapon === 'wrench' ? '#c9d1d9' : this.weapon === 'staff' ? WEAPON_LIBRARY.staff.color : this.saberColor;

                            ctx.save();
                            ctx.lineCap = 'round';
                            ctx.strokeStyle = glowColor;
                            ctx.lineWidth = this.weapon === 'wrench' ? 6 : 7;
                            ctx.shadowBlur = 25;
                            ctx.shadowColor = glowColor;
                            ctx.globalAlpha = 0.6;
                            ctx.beginPath();
                            ctx.moveTo(startX, startY);
                            ctx.lineTo(endX, endY);
                            ctx.stroke();

                            ctx.strokeStyle = '#ffffff';
                            ctx.lineWidth = this.weapon === 'wrench' ? 2 : 2.5;
                            ctx.shadowBlur = 8;
                            ctx.shadowColor = '#ffffff';
                            ctx.globalAlpha = 0.95;
                            ctx.beginPath();
                            ctx.moveTo(startX, startY);
                            ctx.lineTo(endX, endY);
                            ctx.stroke();

                            if (this.weapon === 'wrench') {
                                ctx.strokeStyle = '#7b8794';
                                ctx.lineWidth = 3;
                                ctx.shadowBlur = 0;
                                ctx.globalAlpha = 0.9;
                                ctx.beginPath();
                                ctx.moveTo(endX - 4, endY - 4);
                                ctx.lineTo(endX + 4, endY + 4);
                                ctx.stroke();
                                ctx.beginPath();
                                ctx.moveTo(endX - 4, endY + 4);
                                ctx.lineTo(endX + 4, endY - 4);
                                ctx.stroke();
                            }
                            ctx.restore();
                        }
                    }

                    const now = Date.now();
                    if (now < this.stunnedUntil) {
                        ctx.strokeStyle = '#7efcff';
                        ctx.lineWidth = 3;
                        ctx.setLineDash([6, 6]);
                        ctx.beginPath();
                        ctx.arc(this.x, this.y, CHARACTER_SIZE + 6, 0, Math.PI * 2);
                        ctx.stroke();
                        ctx.setLineDash([]);
                    } else if (now < this.knockedOutUntil) {
                        ctx.fillStyle = '#ffffff';
                        ctx.font = '14px Orbitron';
                        ctx.fillText('Zzz', this.x - 12, this.y - 25);
                    }

                    const drawRadius = this.isWookiee ? CHARACTER_SIZE + 2 : CHARACTER_SIZE;

                    ctx.fillStyle = this.color;
                    ctx.shadowBlur = 10;
                    ctx.shadowColor = this.color;
                    if (this.isDroid) {
                        const hexRadius = CHARACTER_SIZE + 2;
                        ctx.beginPath();
                        for (let i = 0; i < 6; i++) {
                            const angle = Math.PI / 3 * i - Math.PI / 2;
                            const px = this.x + Math.cos(angle) * hexRadius;
                            const py = this.y + Math.sin(angle) * hexRadius;
                            if (i === 0) ctx.moveTo(px, py);
                            else ctx.lineTo(px, py);
                        }
                        ctx.closePath();
                        ctx.fill();
                        ctx.strokeStyle = 'rgba(255,255,255,0.18)';
                        ctx.lineWidth = 2;
                        ctx.stroke();
                    } else {
                        ctx.beginPath();
                        ctx.arc(this.x, this.y, drawRadius, 0, Math.PI * 2);
                        ctx.fill();
                        if (this.isWookiee) {
                            ctx.shadowBlur = 0;
                            ctx.strokeStyle = 'rgba(0,0,0,0.18)';
                            ctx.lineWidth = 2;
                            for (let i = 0; i < 10; i++) {
                                const angle = (Math.PI * 2 * i) / 10 + (i % 2 ? 0.12 : -0.12);
                                const inner = drawRadius - 2;
                                const outer = drawRadius + 5;
                                ctx.beginPath();
                                ctx.moveTo(this.x + Math.cos(angle) * inner, this.y + Math.sin(angle) * inner);
                                ctx.lineTo(this.x + Math.cos(angle) * outer, this.y + Math.sin(angle) * outer);
                                ctx.stroke();
                            }
                        }
                    }
                    ctx.shadowBlur = 0;

                    // Sith dark aura pulse
                    if (this.characterId && characters.villains.some(c => c.id === this.characterId)) {
                        const pulseAlpha = 0.15 + 0.1 * Math.sin(Date.now() / 500);
                        ctx.save();
                        ctx.globalAlpha = pulseAlpha;
                        ctx.fillStyle = '#440000';
                        ctx.shadowBlur = 20;
                        ctx.shadowColor = '#660000';
                        ctx.beginPath();
                        ctx.arc(this.x, this.y, CHARACTER_SIZE + 12, 0, Math.PI * 2);
                        ctx.fill();
                        ctx.restore();
                    }

                    // Clone commander rank marker
                    if (this.isClone && this.characterId && cloneBackupLeaders.has(this.characterId)) {
                        ctx.save();
                        ctx.fillStyle = '#ffd700';
                        ctx.shadowBlur = 8;
                        ctx.shadowColor = '#ffd700';
                        ctx.beginPath();
                        ctx.arc(this.x, this.y - CHARACTER_SIZE - 8, 4, 0, Math.PI * 2);
                        ctx.fill();
                        ctx.restore();
                    }

                    // Hit flash overlay
                    if (Date.now() < this.hitFlashUntil) {
                        ctx.save();
                        ctx.globalAlpha = 0.55;
                        ctx.fillStyle = '#ffffff';
                        ctx.shadowBlur = 22;
                        ctx.shadowColor = '#ff4444';
                        ctx.beginPath();
                        ctx.arc(this.x, this.y, CHARACTER_SIZE + 2, 0, Math.PI * 2);
                        ctx.fill();
                        ctx.restore();
                    }

                    // Name plate above character
                    ctx.save();
                    ctx.font = 'bold 10px Orbitron, sans-serif';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    const label = this.name.length > 16 ? this.name.slice(0,14)+'…' : this.name;
                    const tw = ctx.measureText(label).width;
                    const px = this.x, py = this.y - CHARACTER_SIZE - 14;
                    ctx.fillStyle = 'rgba(0,0,0,0.55)';
                    ctx.beginPath(); ctx.roundRect(px - tw/2 - 5, py - 7, tw + 10, 14, 3); ctx.fill();
                    ctx.fillStyle = this.isMainEntity ? '#ffffff' : 'rgba(255,255,255,0.7)';
                    ctx.fillText(label, px, py);
                    ctx.restore();
                }

                updateHealth(damage) {
                    this.health = Math.max(0, this.health - damage);
                    if (this.health === 0 && this.isAlive) {
                        this.isAlive = false;
                        // death explosion with screen shake
                        triggerScreenShake(8, 15);
                        for (let k = 0; k < 22; k++) {
                            const a = Math.random() * Math.PI * 2;
                            const sp = Math.random() * 4.5 + 1;
                            if (deathParticles.length < MAX_DEATH_PARTICLES) deathParticles.push({ x: this.x, y: this.y, dx: Math.cos(a)*sp, dy: Math.sin(a)*sp, life: 35, maxLife: 35, color: this.color, r: Math.random()*3+1.5 });
                        }
                        if (this.team === 'enemy') {
                            killCount++;
                            // Combo kill tracking
                            const now = Date.now();
                            comboKills.push(now);
                            comboKills = comboKills.filter(k => now - k < 5000);
                            if (comboKills.length >= 3) {
                                tryUnlockAchievement('comboMaster');
                            }
                            // Check if this was the final kill for slow motion
                            const aliveEnemies = entities.filter(e => e.team === 'enemy' && e.isAlive && e !== this);
                            if (aliveEnemies.length === 0) {
                                triggerSlowMotion(0.3, 40);
                            }
                        }
                        // Clone commander death: make backup clones flee
                        if (this.isClone && this.isMainEntity && cloneBackupLeaders.has(this.characterId)) {
                            entities.forEach(e => {
                                if (e.isClone && !e.isMainEntity && e.team === this.team && e.isAlive) {
                                    e.isFleeing = true;
                                    e.hasFled = true; // Mark as fled so they don't count as killed
                                    
                                    // Find the enemy to flee from
                                    const enemy = entities.find(ent => ent.team !== e.team && ent.isAlive);
                                    if (enemy) {
                                        // Flee away from the enemy
                                        const angleToEnemy = Math.atan2(enemy.y - e.y, enemy.x - e.x);
                                        const fleeAngle = angleToEnemy + Math.PI; // Opposite direction
                                        
                                        e.vx = Math.cos(fleeAngle) * 8;
                                        e.vy = Math.sin(fleeAngle) * 8;
                                    } else {
                                        // If no enemy found, flee towards nearest edge
                                        const distToLeft = e.x;
                                        const distToRight = canvasLogicalW - e.x;
                                        const distToTop = e.y;
                                        const distToBottom = canvasLogicalH - e.y;
                                        
                                        const minDist = Math.min(distToLeft, distToRight, distToTop, distToBottom);
                                        let fleeAngle;
                                        if (minDist === distToLeft) fleeAngle = Math.PI;
                                        else if (minDist === distToRight) fleeAngle = 0;
                                        else if (minDist === distToTop) fleeAngle = -Math.PI/2;
                                        else fleeAngle = Math.PI/2;
                                        
                                        e.vx = Math.cos(fleeAngle) * 8;
                                        e.vy = Math.sin(fleeAngle) * 8;
                                    }
                                }
                            });
                        }
                    }
                }
            }

            class Projectile {
                constructor(x, y, dx, dy, weaponConfig, owner) {
                    this.x = x;
                    this.y = y;
                    this.dx = dx;
                    this.dy = dy;
                    this.weaponConfig = weaponConfig;
                    this.owner = owner;
                    this.color = weaponConfig.color || owner.color;
                    this.damage = weaponConfig.damage;
                    this.variance = weaponConfig.variance || 0;
                    this.type = weaponConfig.key;
                    this.spin = !!weaponConfig.spin;
                    this.spinAngle = Math.random() * Math.PI * 2;
                    this.rotation = Math.atan2(dy, dx);
                    this.blocked = false;
                }

                step(tickScale) {
                    this.x += this.dx * tickScale;
                    this.y += this.dy * tickScale;
                    this.rotation = Math.atan2(this.dy, this.dx);
                    if (this.spin) this.spinAngle += 0.42 * tickScale;

                    if (this.returnable && !this.returning) {
                        this.travelled += Math.hypot(this.dx * tickScale, this.dy * tickScale);
                        if (this.travelled >= this.maxDistance || this.x < -40 || this.x > canvasLogicalW + 40 || this.y < -40 || this.y > canvasLogicalH + 40) {
                            this.returning = true;
                        }
                    }

                    if (this.returnable && this.returning && this.owner && this.owner.isAlive) {
                        const returnAngle = Math.atan2(this.owner.y - this.y, this.owner.x - this.x);
                        const speed = this.returnSpeed;
                        this.dx = Math.cos(returnAngle) * speed;
                        this.dy = Math.sin(returnAngle) * speed;
                        if (Math.hypot(this.owner.x - this.x, this.owner.y - this.y) < CHARACTER_SIZE) {
                            this.collected = true;
                        }
                    }
                }

                draw() {
                    ctx.save();
                    ctx.translate(this.x, this.y);

                    const drawAngle = this.rotation + this.spinAngle;

                    if (this.weaponConfig.draw === 'zap') {
                        ctx.rotate(drawAngle);
                        ctx.strokeStyle = this.color;
                        ctx.lineWidth = 2.5;
                        ctx.shadowBlur = 12;
                        ctx.shadowColor = this.color;
                        ctx.beginPath();
                        ctx.moveTo(-2, 0); ctx.lineTo(5, -4); ctx.lineTo(10, 4); ctx.lineTo(16, -3); ctx.lineTo(22, 3);
                        ctx.stroke();

                        ctx.strokeStyle = '#ffffff';
                        ctx.lineWidth = 1.2;
                        ctx.shadowBlur = 4;
                        ctx.beginPath();
                        ctx.moveTo(-2, 0); ctx.lineTo(5, -4); ctx.lineTo(10, 4); ctx.lineTo(16, -3); ctx.lineTo(22, 3);
                        ctx.stroke();
                    } else if (this.weaponConfig.draw === 'wrench') {
                        ctx.rotate(drawAngle);
                        ctx.fillStyle = '#b8bec7';
                        ctx.strokeStyle = '#7b8794';
                        ctx.lineWidth = 2;
                        ctx.shadowBlur = 10;
                        ctx.shadowColor = '#b8bec7';
                        ctx.beginPath(); ctx.roundRect(-10, -3, 18, 6, 2); ctx.fill(); ctx.stroke();
                        ctx.beginPath(); ctx.roundRect(5, -7, 10, 14, 3); ctx.fill(); ctx.stroke();
                        ctx.shadowBlur = 0;
                        ctx.fillStyle = '#7b8794';
                        ctx.beginPath(); ctx.arc(10, 0, 2.8, 0, Math.PI * 2); ctx.fill();
                    } else if (this.weaponConfig.draw === 'staff') {
                        ctx.rotate(drawAngle);
                        ctx.strokeStyle = this.color;
                        ctx.lineWidth = 6;
                        ctx.shadowBlur = 14;
                        ctx.shadowColor = this.color;
                        ctx.globalAlpha = 0.75;
                        ctx.beginPath(); ctx.moveTo(-this.weaponConfig.length / 2, 0); ctx.lineTo(this.weaponConfig.length / 2, 0); ctx.stroke();

                        ctx.strokeStyle = '#ffffff';
                        ctx.lineWidth = 2;
                        ctx.shadowBlur = 4;
                        ctx.globalAlpha = 1;
                        ctx.beginPath(); ctx.moveTo(-this.weaponConfig.length / 2, 0); ctx.lineTo(this.weaponConfig.length / 2, 0); ctx.stroke();
                    } else if (this.weaponConfig.draw === 'saber') {
                        ctx.rotate(drawAngle);
                        ctx.lineCap = 'round';
                        ctx.strokeStyle = this.owner.saberColor || this.color;
                        ctx.lineWidth = 6;
                        ctx.shadowBlur = 16;
                        ctx.shadowColor = this.owner.saberColor || this.color;
                        ctx.globalAlpha = 0.7;
                        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(this.weaponConfig.length, 0); ctx.stroke();

                        ctx.strokeStyle = '#ffffff';
                        ctx.lineWidth = 2;
                        ctx.shadowBlur = 5;
                        ctx.globalAlpha = 1;
                        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(this.weaponConfig.length, 0); ctx.stroke();
                    } else {
                        ctx.rotate(this.rotation);
                        ctx.fillStyle = this.color;
                        ctx.shadowBlur = 8;
                        ctx.shadowColor = this.color;
                        ctx.fillRect(0, -2, this.weaponConfig.length, 4);
                    }
                    ctx.restore();
                }
            }

            let selectedPlayerCharId = null;
            let specialTatooineJabbaForce = false;
            let specialTatooineJabbaHold = 0;
            let specialTatooineJabbaSpawned = false;
            let specialTatooineJabbaCharacter = null;
            let specialTatooineGuardTimer = 0;
            let playableJabbaGuardCount = 0;
            let playableJabbaNextGuard = 0;

            function showOpponentPicker(playerCharId) {
                selectedPlayerCharId = playerCharId;
                const allCharactersList = [...characters.heroes, ...characters.villains, ...characters.secret];
                const pChar = allCharactersList.find(c => c.id === playerCharId);
                if (!pChar) return;

                vsBannerPlayer.textContent = pChar.name;
                vsBannerPlayer.style.color = pChar.color;

                const oppHeroContainer = document.getElementById('opp-hero-roster');
                const oppVillainContainer = document.getElementById('opp-villain-roster');
                oppHeroContainer.innerHTML = '';
                oppVillainContainer.innerHTML = '';

                const allChars = { heroes: characters.heroes, villains: characters.villains };
                Object.entries(allChars).forEach(([faction, list]) => {
                    const container = faction === 'heroes' ? oppHeroContainer : oppVillainContainer;
                    const btnClass = faction === 'heroes' ? 'opp-hero-btn' : 'opp-villain-btn';
                    list.forEach(char => {
                        const btn = document.createElement('button');
                        btn.className = `opp-char-button ${btnClass}${char.id === playerCharId ? ' is-self' : ''}`;
                        const weapon = getWeapon(char);
                        const em = weaponEmoji[char.weapon] || '⚔️';
                        const droidTag = char.isDroid ? '<br>• DROID •' : '';
                        btn.innerHTML = `<span style="margin-bottom:2px">${em} ${char.name}${char.id === playerCharId ? ' ★' : ''}</span><span class="char-hp">${char.hp} HP • ${weapon.label}${droidTag}</span>`;
                        btn.style.borderLeftColor = char.color;
                        btn.style.borderLeftWidth = '3px';
                        
                        if (isMobileView()) {
                            // Mobile: tap-once-to-preview, tap-again-to-confirm
                            btn.addEventListener('click', (e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                
                                if (mobilePreviewState.active && mobilePreviewState.char === char) {
                                    // Second tap on same button: confirm selection
                                    hideStatCard();
                                    mobilePreviewState.active = false;
                                    mobilePreviewState.char = null;
                                    mobilePreviewState.btn = null;
                                    mainMenu.style.display = 'none';
                                    opponentMenu.style.display = 'none';
                                    setupGame(playerCharId, char.id, { enemyFromRandom: false });
                                } else {
                                    // First tap: show preview
                                    if (mobilePreviewState.btn) {
                                        mobilePreviewState.btn.style.borderColor = '';
                                        mobilePreviewState.btn.style.filter = '';
                                    }
                                    mobilePreviewState.active = true;
                                    mobilePreviewState.char = char;
                                    mobilePreviewState.btn = btn;
                                    showStatCard(char, btn);
                                    btn.style.borderColor = '#00A4FF';
                                    btn.style.filter = 'brightness(1.3)';
                                }
                            });
                        } else {
                            // Desktop: hover behavior
                            btn.addEventListener('mouseenter', () => showStatCard(char, btn));
                            btn.addEventListener('mouseleave', hideStatCard);
                            btn.addEventListener('click', () => {
                                hideStatCard();
                                mainMenu.style.display = 'none';
                                opponentMenu.style.display = 'none';
                                setupGame(playerCharId, char.id, { enemyFromRandom: false });
                            });
                        }
                        
                        container.appendChild(btn);
                    });
                });

                mainMenu.style.display = 'none';
                opponentMenu.style.display = 'flex';
                
                setTimeout(() => {
                    const surprise = document.getElementById('surpriseBtn');
                    if (surprise) surprise.focus();
                }, 50);
            }

            surpriseBtn.addEventListener('click', () => {
                if (!selectedPlayerCharId) return;
                const all = [...characters.heroes, ...characters.villains];
                const playerChar = all.find(c => c.id === selectedPlayerCharId);
                
                // Determine opposing faction
                let opponentPool;
                if (characters.heroes.includes(playerChar)) {
                    opponentPool = characters.villains;
                } else if (characters.villains.includes(playerChar)) {
                    opponentPool = characters.heroes;
                } else {
                    opponentPool = all;
                }
                
                // Exception: Obi-Wan can randomly pick Anakin for burnt Anakin unlock
                let random;
                if (selectedPlayerCharId === 'obiwan' && !gameUnlocks.burntAnakin && Math.random() <= 0.15) {
                    random = characters.villains.find(c => c.id === 'anakin');
                } else if (currentArena === 'tatooine' && selectedPlayerCharId === 'leia' && gameUnlocks.tatooineArena && (specialTatooineJabbaForce || Math.random() < 0.2)) {
                    random = characters.unplayable.find(c => c.id === 'carbonite_han');
                    specialTatooineJabbaForce = false;
                    if (!random) random = opponentPool[Math.floor(Math.random() * opponentPool.length)];
                    else showAnnouncement('A carbonite showdown has begun... Find Han and hold E to call Jabba!', '#888888', 5000, '🧊 CARBONITE EVENT');
                } else {
                    random = opponentPool[Math.floor(Math.random() * opponentPool.length)];
                }
                
                opponentMenu.style.display = 'none';
                setupGame(selectedPlayerCharId, random.id, { enemyFromRandom: true });
            });

            backBtn.addEventListener('click', () => {
                playMenuMusic();
                opponentMenu.style.display = 'none';
                mainMenu.style.display = 'flex';
                selectedPlayerCharId = null;
            });

            function setupGame(playerCharacterId, enemyCharacterId, matchOpts = {}) {
                const enemyFromRandom = !!matchOpts.enemyFromRandom;
                let actualEnemyId = enemyCharacterId;

                // Always close the pause menu and reset pause state when a new game begins
                gamePaused = false;
                pauseOverlay.classList.remove('active');

                resetJabbaEventState();

                if (playerCharacterId === 'babu' && Math.random() <= 0.15) {
                    actualEnemyId = 'sith_c3po';
                    showAnnouncement("A dark protocol presence approaches... Sith C-3PO has intercepted your transmission! Duel him!", "#ffd700", 5000, "⚠️ INTERCEPTED");
                }

                // Reset series on a fresh matchup; preserve on "Next Round"
                if (!isNextRound) {
                    playerWins = 0;
                    enemyWins = 0;
                    seriesEnemyFromRandom = enemyFromRandom;
                    seriesBendyBattleSrc = null; // Allow a fresh Bendy track pick for the new series
                }
                isNextRound = false;
                seriesPlayerCharId = playerCharacterId;
                seriesEnemyCharId = actualEnemyId;

                const all = [...characters.heroes, ...characters.villains, ...characters.secret, ...characters.unplayable];
                pCharData = all.find(c => c.id === playerCharacterId);
                eCharData = all.find(c => c.id === actualEnemyId);

                // Use button-selected difficulty settings
                const ds = diffSettings[currentDifficulty];
                const eHp = Math.round(eCharData.hp * ds.hpMult);

                mainPlayer = new Character(canvasLogicalW / 4, canvasLogicalH / 2, pCharData.color, pCharData.name, pCharData.hp, pCharData.weapon, pCharData.saberColor, pCharData.isDroid, pCharData.isWookiee, 'player', true, pCharData.isClone, pCharData.weaponDamage, pCharData.id);
                mainEnemy = new Character(canvasLogicalW * 3 / 4, canvasLogicalH / 2, eCharData.color, eCharData.name, eHp, eCharData.weapon, eCharData.saberColor, eCharData.isDroid, eCharData.isWookiee, 'enemy', true, eCharData.isClone, eCharData.weaponDamage, eCharData.id);
                if (eCharData.id === 'carbonite_han') {
                    mainEnemy.isFrozen = true;
                    mainEnemy.color = '#888888';
                    mainEnemy.weaponConfig = getWeapon({ weapon: 'blaster', weaponDamage: eCharData.weaponDamage });
                }
                
                entities = [mainPlayer, mainEnemy];
                bullets = [];
                clashParticles = [];
                hitSparks = [];
                impactParticles = [];
                saberTrails = [];
                dodgeFlashes = [];
                screenShake = { intensity: 0, duration: 0 };
                slowMotion = { active: false, scale: 1, duration: 0 };
                killCamera = { active: false, target: null, zoom: 1, duration: 0 };
                comboKills = [];

                playBattleMusic();

                // ── SFX: lightsaber ignition on match start ────────────
                const saberWeaponKeys = ['lightsaber', 'darksaber'];
                if (saberWeaponKeys.includes(pCharData.weapon) || saberWeaponKeys.includes(eCharData.weapon)) {
                    playSound('lightsaberIgnite');
                    setTimeout(() => playSound('lightsaberHum'), 900);
                }
                mainMenu.style.display = 'none';
                // Hide developer and settings UI during battles
                const devMenuToggleEl = document.getElementById('devMenuToggle');
                const devMenuPanelEl = document.getElementById('devMenuPanel');
                const settingsBtnEl = document.getElementById('settingsBtn');
                const settingsPanelEl = document.getElementById('settingsPanel');
                const fullscreenBtnEl = document.getElementById('fullscreenBtn');
                if (devMenuToggleEl) { devMenuToggleEl.classList.remove('is-visible'); devMenuToggleEl.style.display = 'none'; }
                if (devMenuPanelEl) devMenuPanelEl.style.display = 'none';
                if (settingsBtnEl) settingsBtnEl.style.display = 'none';
                if (settingsPanelEl) settingsPanelEl.style.display = 'none';
                if (fullscreenBtnEl) fullscreenBtnEl.style.display = 'none';
                canvas.style.display = 'block';
                resizeCanvas();
                hud.style.display = 'flex';
                messageOverlay.style.display = 'none';
                updateMobileControlsVisibility();

                // Portrait cards
                const playerPortrait = document.getElementById('playerPortrait');
                playerPortrait.textContent = weaponEmoji[pCharData.weapon] || '⚔️';
                playerPortrait.style.color = mainPlayer.color;
                playerPortrait.style.borderColor = mainPlayer.color;
                playerPortrait.style.boxShadow = `0 0 10px ${mainPlayer.color}55`;

                const enemyPortrait = document.getElementById('enemyPortrait');
                enemyPortrait.textContent = weaponEmoji[eCharData.weapon] || '⚔️';
                enemyPortrait.style.color = mainEnemy.color;
                enemyPortrait.style.borderColor = mainEnemy.color;
                enemyPortrait.style.boxShadow = `0 0 10px ${mainEnemy.color}55`;

                playerLabel.textContent = mainPlayer.name;
                playerLabel.style.color = mainPlayer.color;
                playerHealthBar.style.backgroundColor = mainPlayer.color;
                document.getElementById('playerWeaponLabel').textContent = getWeapon(pCharData).label.toUpperCase();

                enemyLabel.textContent = mainEnemy.name;
                enemyLabel.style.color = mainEnemy.color;
                enemyHealthBar.style.backgroundColor = mainEnemy.color;
                document.getElementById('enemyWeaponLabel').textContent = getWeapon(eCharData).label.toUpperCase();

                updateRoundPips();
                killCount = 0;
                playerDamageDealt = 0;
                playerShotsFired = 0;
                playerHitsLanded = 0;
                deathParticles = [];
                floatNums = [];
                playerTookDamage = false;
                bowcasterCharging = false;
                bowcasterCharge = 0;
                bowcasterChargeStart = 0;
                computerCharging = false;
                computerCharge = 0;
                computerChargeStart = 0;
                spawnCover();

                // ── 3-2-1 COUNTDOWN ──────────────────────────────────
                // Freeze the HUD timer until after the countdown
                countdownActive = true;
                document.getElementById('hudTimer').style.display = 'none';
                let countdownStep = 0; // 0=3, 1=2, 2=1, 3=GO! → then start
                const countdownDurations = [700, 700, 700, 600]; // ms per step

                function drawCountdownFrame(label, subLabel) {
                    const w = canvasLogicalW, h = canvasLogicalH;
                    // Draw the arena background first so it isn't black
                    draw(0);
                    // Dim overlay
                    ctx.save();
                    ctx.fillStyle = 'rgba(0,0,0,0.55)';
                    ctx.fillRect(0, 0, w, h);

                    // Number or GO!
                    const isGo = label === 'GO!';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.font = `bold ${Math.round(h * (isGo ? 0.22 : 0.26))}px Orbitron, sans-serif`;
                    const numColor = isGo ? '#00ff88' : '#ffffff';
                    ctx.fillStyle = numColor;
                    ctx.shadowColor = numColor;
                    ctx.shadowBlur = 50;
                    ctx.fillText(label, w * 0.5, h * 0.5);
                    ctx.restore();
                }

                function countdownTick() {
                    const labels = ['3', '2', '1', 'GO!'];
                    drawCountdownFrame(labels[countdownStep]);
                    const delay = countdownDurations[countdownStep];
                    countdownStep++;
                    if (countdownStep < labels.length) {
                        setTimeout(countdownTick, delay);
                    } else {
                        // Countdown done — start the real game
                        countdownActive = false;
                        gameStartTime = Date.now();
                        startTimer();
                        lastGameFrameTime = 0;
                        gameLoopId = requestAnimationFrame(gameLoop);
                    }
                }
                setTimeout(countdownTick, 50); // slight delay so canvas is rendered
            }

            function fireProjectile(shooter, target, weaponConfig) {
                let angle = Math.atan2(target.y - shooter.y, target.x - shooter.x);
                // Blasters/bowcasters have natural spread
                if (weaponConfig.key === 'blaster' || weaponConfig.key === 'bowcaster') {
                    angle += (Math.random() - 0.5) * 0.14;
                }
                const dx = Math.cos(angle) * weaponConfig.speed;
                const dy = Math.sin(angle) * weaponConfig.speed;
                const projectile = new Projectile(shooter.x, shooter.y, dx, dy, weaponConfig, shooter);
                if (shooter === mainPlayer) playerShotsFired++;
                if (weaponConfig.returnable) {
                    projectile.returnable = true;
                    projectile.returning = false;
                    projectile.travelled = 0;
                    projectile.maxDistance = Math.max(220, weaponConfig.length * 6);
                    projectile.returnSpeed = weaponConfig.speed * 1.1;
                }
                if (bullets.length < MAX_BULLETS) bullets.push(projectile);

                // ── SFX: fire sounds for all shooters ─────────────────
                const wk = weaponConfig.key;
                if (wk === 'blaster') {
                    playSound('blasterShot', 60);
                } else if (wk === 'bowcaster') {
                    playSound('bowcasterShot', 100);
                } else if (wk === 'lightning') {
                    playSound('forceLightning', 200);
                } else if (wk === 'zap') {
                    playSound('zap', 450);
                } else if (weaponConfig.returnable) {
                    playSound('lightsaberThrow', 300);
                }
            }

            function getClosestEnemy(entity) {
                let enemiesList = entities.filter(e => e.isAlive && e.team !== entity.team);
                if (enemiesList.length === 0) return null;
                return enemiesList.reduce((closest, current) => {
                    let d1 = Math.hypot(closest.x - entity.x, closest.y - entity.y);
                    let d2 = Math.hypot(current.x - entity.x, current.y - entity.y);
                    return d2 < d1 ? current : closest;
                });
            }

            function resetJabbaEventState() {
                specialTatooineJabbaHold = 0;
                specialTatooineJabbaSpawned = false;
                specialTatooineJabbaCharacter = null;
                specialTatooineGuardTimer = 0;
                playableJabbaGuardCount = 0;
                playableJabbaNextGuard = Date.now() + 2200;
            }

            function spawnJabbaHutt() {
                if (specialTatooineJabbaSpawned) return;
                specialTatooineJabbaSpawned = true;
                specialTatooineGuardTimer = Date.now() + 2200;

                const jabba = new Character(
                    Math.min(canvasLogicalW - CHARACTER_SIZE - 60, Math.max(CHARACTER_SIZE + 60, mainEnemy.x + 80)),
                    Math.min(canvasLogicalH - CHARACTER_SIZE - 40, Math.max(CHARACTER_SIZE + 40, mainEnemy.y)),
                    '#a67a1c', 'Jabba the Hutt', 260, 'blaster', '#a67a1c', false, false, 'enemy', false, false, 0
                );
                jabba.characterId = 'jabba';
                jabba.isJabba = true;
                jabba.lastShotTime = Date.now();
                entities.push(jabba);
                specialTatooineJabbaCharacter = jabba;
                showAnnouncement('Jabba has arrived. He does not fight directly — his Gamorrean guards will come for you!', '#a67a1c', 5000, '🐸 JABBA ARRIVES');
            }

            function spawnGamorreanGuard() {
                if (!specialTatooineJabbaSpawned || !specialTatooineJabbaCharacter || !specialTatooineJabbaCharacter.isAlive) return;
                const activeGuards = entities.filter(e => e.isAlive && e.characterId === 'gamorrean_guard').length;
                if (activeGuards >= 3) return;
                const angle = Math.random() * Math.PI * 2;
                const spawnDist = 110 + Math.random() * 50;
                const x = Math.min(canvasLogicalW - CHARACTER_SIZE, Math.max(CHARACTER_SIZE, specialTatooineJabbaCharacter.x + Math.cos(angle) * spawnDist));
                const y = Math.min(canvasLogicalH - CHARACTER_SIZE, Math.max(CHARACTER_SIZE, specialTatooineJabbaCharacter.y + Math.sin(angle) * spawnDist));
                const guard = new Character(x, y, '#cc3333', 'Gamorrean Guard', 95, 'blaster', '#cc3333', false, false, 'enemy', false, false, 18);
                guard.characterId = 'gamorrean_guard';
                guard.lastShotTime = Date.now() - Math.random() * 600;
                entities.push(guard);
            }

            function spawnPlayableGamorreanGuard() {
                if (!mainPlayer || !mainPlayer.isAlive || !pCharData || pCharData.id !== 'jabba') return;
                const activeGuards = entities.filter(e => e.isAlive && e.characterId === 'gamorrean_guard').length;
                if (activeGuards >= 6) return;
                playableJabbaGuardCount++;
                const angle = Math.random() * Math.PI * 2;
                const spawnDist = 110 + Math.random() * 50;
                const x = Math.min(canvasLogicalW - CHARACTER_SIZE, Math.max(CHARACTER_SIZE, mainPlayer.x + Math.cos(angle) * spawnDist));
                const y = Math.min(canvasLogicalH - CHARACTER_SIZE, Math.max(CHARACTER_SIZE, mainPlayer.y + Math.sin(angle) * spawnDist));
                const guard = new Character(x, y, '#cc3333', 'Gamorrean Guard', 95, 'blaster', '#cc3333', false, false, 'player', false, true, 18);
                guard.characterId = 'gamorrean_guard';
                guard.lastShotTime = Date.now() - Math.random() * 600;
                entities.push(guard);
            }

            function applyStatusAndDamage(target, projectile) {
                let damage = projectile.damage;
                // Apply per-weapon variance: roll a random multiplier within ±variance range
                const variance = projectile.variance || 0;
                if (variance > 0) {
                    damage *= (1 - variance) + Math.random() * variance * 2;
                }
                damage = Math.round(damage);
                const now = Date.now();
                if (target === mainPlayer && invincibilityEnabled) return;
                const isMeleeWeapon = ['lightsaber','darksaber','staff','wrench'].includes(projectile.type);

                // Shield absorption
                if (target.shieldActive && now < target.shieldUntil) {
                    target.shieldActive = false;
                    target.shieldUntil = 0;
                    spawnHitSparks(target.x, target.y, '#00aaff', 15);
                    return; // Shield absorbs the hit completely
                }

                // Melee range bonus: +40% damage if shooter is within 100px
                const shooterDist = Math.hypot(target.x - projectile.owner.x, target.y - projectile.owner.y);
                if (isMeleeWeapon && shooterDist < 100) {
                    damage *= 1.4;
                }

                if (projectile.type === 'zap') {
                    if (!target.isDroid) {
                        // 40% chance to resist stun entirely; if it lands, only 600ms stun
                        if (now > target.zapImmunityUntil && Math.random() > 0.4) {
                            target.stunnedUntil = now + 600;
                            target.wasStunned = true;
                        }
                    }
                } else if (projectile.type === 'wrench') {
                    if (!target.isDroid) {
                        // 50% chance to resist knockdown; if it lands, only 900ms
                        if (now > target.wrenchImmunityUntil && Math.random() > 0.5) {
                            target.knockedOutUntil = now + 900;
                            target.wasKnockedOut = true;
                        }
                    } else {
                        damage *= WEAPON_LIBRARY.wrench.vsDroidMultiplier; 
                    }
                }

                // Knockback — melee hits punch harder
                const kbAngle = Math.atan2(target.y - projectile.owner.y, target.x - projectile.owner.x);
                const kbStrength = isMeleeWeapon ? 10 : 4;
                target.vx += Math.cos(kbAngle) * kbStrength;
                target.vy += Math.sin(kbAngle) * kbStrength;

                target.updateHealth(damage);

                // ── SFX: hit sounds based on weapon type ──────────────
                const pt = projectile.type;
                if (pt === 'wrench') {
                    playSound('wrenchHit', 120);
                } else if (pt === 'lightsaber' || pt === 'darksaber' || pt === 'staff') {
                    playSound('lightsaberClash', 90);
                } else if (pt === 'zap' || pt === 'lightning') {
                    playSound('zap', 350);
                }

                // Spawn hit sparks and impact particles
                const sparkColor = isMeleeWeapon ? projectile.owner.saberColor || projectile.owner.color : projectile.color;
                spawnHitSparks(target.x, target.y, sparkColor, isMeleeWeapon ? 15 : 10);
                if (!isMeleeWeapon) {
                    spawnImpactParticles(target.x, target.y, projectile.color, 8);
                }

                // Track player damage for achievement
                if (target.team === 'player' && target.isMainEntity) playerTookDamage = true;
                // Track player damage dealt & accuracy
                if (projectile.owner === mainPlayer && target.team === 'enemy') {
                    playerDamageDealt += Math.round(damage);
                    playerHitsLanded++;
                }

                // Hit flash — canvas + HUD portrait
                target.hitFlashUntil = now + 90;
                const portraitId = target.team === 'player' ? 'playerPortrait' : 'enemyPortrait';
                const portrait = document.getElementById(portraitId);
                if (portrait) {
                    portrait.classList.remove('hit-flash');
                    void portrait.offsetWidth;
                    portrait.classList.add('hit-flash');
                }

                // floating damage number
                const dmgRounded = Math.round(damage);
                if (floatNums.length < MAX_FLOATS) floatNums.push({ x: target.x + (Math.random()-0.5)*20, y: target.y - CHARACTER_SIZE - 10, text: dmgRounded, life: 45, maxLife: 45, dy: -1.2 });
            }

            function update(tickScale) {
                // Update visual effects
                updateScreenShake(tickScale);
                updateHitSparks(tickScale);
                updateImpactParticles(tickScale);
                updateSaberTrails(tickScale);
                updateDodgeFlashes(tickScale);
                updateLowHealthVignette();

                let aliveEntities = entities.filter(e => e.isAlive);
                
                aliveEntities.forEach(e => {
                    if (e.isClone && e.isMainEntity && e.health <= (e.maxHealth - 25) && !e.hasCalledBackup) {
                        const isCommander = cloneBackupLeaders.has(e.characterId);
                        let backupInfo;
                        
                        if (isCommander) {
                            backupInfo = cloneBackupArmy[e.characterId];
                        } else {
                            // Regular clone troopers spawn troops with their own name
                            backupInfo = { unitId: e.characterId, name: e.name };
                        }
                        
                        e.hasCalledBackup = true;
                        const ds = diffSettings[currentDifficulty];
                        
                        // Commanders always get all troops, regular clones get random amount (1-4)
                        const troopCount = isCommander ? ds.alliesCount : Math.floor(Math.random() * 4) + 1;
                        
                        for(let i = 0; i < troopCount; i++) {
                            let offsetX = (Math.random() - 0.5) * 80;
                            let offsetY = (Math.random() - 0.5) * 80;
                            
                            let backupDamage = e.weaponConfig.damage * 0.5;
                            let backup = new Character(
                                e.x + offsetX,
                                e.y + offsetY,
                                e.color,
                                backupInfo.name,
                                50,
                                e.weapon,
                                e.saberColor,
                                e.isDroid,
                                false,
                                e.team,
                                false,
                                true,
                                backupDamage
                            );
                            backup.health = 50;
                            backup.characterId = backupInfo.unitId;
                            backup.hasCalledBackup = true;
                            backup.lastShotTime = Date.now() - Math.random() * 500;
                            entities.push(backup);
                        }
                    }
                });

                aliveEntities = entities.filter(e => e.isAlive);

                aliveEntities.forEach(e => {
                    const now = Date.now();

                    if (now > e.stunnedUntil && e.wasStunned) {
                        e.wasStunned = false;
                        e.zapImmunityUntil = now + 1000; 
                    }
                    if (now > e.knockedOutUntil && e.wasKnockedOut) {
                        e.wasKnockedOut = false;
                        e.wrenchImmunityUntil = now + 3000; 
                    }

                    const canAct = now > e.stunnedUntil && now > e.knockedOutUntil;
                    if (!canAct) return;

                    if (e.isMainEntity && e.team === 'player') {
                        let moveX = 0, moveY = 0;
                        if (keys['ArrowLeft'] || keys['a']) moveX -= 1;
                        if (keys['ArrowRight'] || keys['d']) moveX += 1;
                        if (keys['ArrowUp'] || keys['w']) moveY -= 1;
                        if (keys['ArrowDown'] || keys['s']) moveY += 1;

                        if (touchMove.active) {
                            moveX = touchMove.x;
                            moveY = touchMove.y;
                        }

                        if (currentArena === 'tatooine' && pCharData && pCharData.id === 'leia' && eCharData && eCharData.id === 'carbonite_han' && !specialTatooineJabbaSpawned) {
                            const han = entities.find(x => x.characterId === 'carbonite_han' && x.isAlive);
                            const holdKey = keys['e'] || keys['E'];
                            if (han && holdKey && Math.hypot(han.x - e.x, han.y - e.y) < 80) {
                                specialTatooineJabbaHold += 16.7 * tickScale;
                                if (specialTatooineJabbaHold >= 1200) {
                                    spawnJabbaHutt();
                                }
                            } else {
                                specialTatooineJabbaHold = 0;
                            }
                        } else if (!keys['e'] && !keys['E']) {
                            specialTatooineJabbaHold = 0;
                        }

                        // Dodge mechanic (Shift key) — Jabba cannot dodge
                        if (e.characterId !== 'jabba' && keys['Shift'] && !e.isDodging && now > e.dodgeCooldown) {
                            e.isDodging = true;
                            e.dodgeEnd = now + 200;
                            e.dodgeCooldown = now + 1500;
                            spawnDodgeFlash(e);
                            
                            // Dodge in movement direction or toward enemy
                            let dodgeAngle = 0;
                            if (moveX !== 0 || moveY !== 0) {
                                dodgeAngle = Math.atan2(moveY, moveX);
                            } else {
                                const target = getClosestEnemy(e);
                                if (target) {
                                    dodgeAngle = Math.atan2(target.y - e.y, target.x - e.x);
                                }
                            }
                            
                            const dodgeSpeed = 12;
                            e.vx += Math.cos(dodgeAngle) * dodgeSpeed;
                            e.vy += Math.sin(dodgeAngle) * dodgeSpeed;
                        }

                        if (e.isDodging && now > e.dodgeEnd) {
                            e.isDodging = false;
                        }

                        const spaceHeld = !!(keys[' '] || touchFire);
                        if (moveX !== 0 || moveY !== 0) {
                            const mag = Math.min(1, Math.hypot(moveX, moveY));
                            const angle = Math.atan2(moveY, moveX);
                            const jabbaSlug   = e.characterId === 'jabba' ? 0.3 : 1;
                            const chargeSlug  = (e.weapon === 'bowcaster' && (spaceHeld || bowcasterCharging)) || (e.weapon === 'computer' && computerCharging) ? 0.45 : 1;
                            const speedMultiplier = e.isDodging ? 2.5 : jabbaSlug * chargeSlug;
                            e.x += Math.cos(angle) * PLAYER_SPEED * mag * tickScale * speedMultiplier;
                            e.y += Math.sin(angle) * PLAYER_SPEED * mag * tickScale * speedMultiplier;
                            // Wookiees have thunderous footsteps
                            sfxSounds.walking.volume = (pCharData && pCharData.isWookiee) ? 0.84 : 0.28;
                            playSound('walking');
                        } else {
                            sfxSounds.walking.volume = 0.28;
                            stopSound('walking');
                        }

                        if (e.characterId !== 'jabba') {
                            const ammoBoostActive = now < e.ammoBoostUntil;
                            const effectiveCooldown = ammoBoostActive ? 0 : e.weaponConfig.cooldown;
                            
                            if (e.weapon === 'bowcaster') {
                                // ── BOWCASTER CHARGE ──────────────────────────────
                                if (spaceHeld && now - e.lastShotTime > effectiveCooldown) {
                                    if (!bowcasterCharging) {
                                        bowcasterCharging = true;
                                        bowcasterChargeStart = now;
                                    }
                                    bowcasterCharge = Math.min(1, (now - bowcasterChargeStart) / BOWCASTER_MAX_CHARGE_MS);
                                } else if (!spaceHeld && bowcasterCharging) {
                                    // Release — fire proportional to charge
                                    const target = getClosestEnemy(e);
                                    if (target) {
                                        const chargeMult = 1 + bowcasterCharge * 2; // 1× – 3×
                                        const chargedConfig = { ...e.weaponConfig, damage: e.weaponConfig.damage * chargeMult };
                                        fireProjectile(e, target, chargedConfig);
                                        e.lastShotTime = now;
                                    }
                                    bowcasterCharging = false;
                                    bowcasterCharge = 0;
                                }
                            } else if (e.weapon === 'computer') {
                                // ── COMPUTER CHARGE ──────────────────────────────
                                if (spaceHeld && now - e.lastShotTime > effectiveCooldown) {
                                    if (!computerCharging) {
                                        computerCharging = true;
                                        computerChargeStart = now;
                                    }
                                    computerCharge = Math.min(1, (now - computerChargeStart) / COMPUTER_MAX_CHARGE_MS);
                                } else if (!spaceHeld && computerCharging) {
                                    // Release — fire proportional to charge
                                    const target = getClosestEnemy(e);
                                    if (target) {
                                        const chargeMult = 1 + computerCharge * 2; // 1× – 3×
                                        const chargedConfig = { ...e.weaponConfig, damage: e.weaponConfig.damage * chargeMult };
                                        fireProjectile(e, target, chargedConfig);
                                        e.lastShotTime = now;
                                    }
                                    computerCharging = false;
                                    computerCharge = 0;
                                }
                            } else if (spaceHeld && now - e.lastShotTime > effectiveCooldown) {
                                // ── NORMAL FIRE ───────────────────────────────────
                                let target = getClosestEnemy(e);
                                if (target) {
                                    fireProjectile(e, target, e.weaponConfig);
                                    e.lastShotTime = now;
                                }
                            }
                        }
                    } else {
                        if (e.isJabba || e.characterId === 'jabba' || e.characterId === 'carbonite_han' || e.isFrozen) return;
                        
                        // Handle fleeing clones
                        if (e.isFleeing) {
                            // Continue fleeing towards the edge but stop at boundary
                            e.x += e.vx * tickScale;
                            e.y += e.vy * tickScale;
                            e.x = Math.max(CHARACTER_SIZE, Math.min(canvasLogicalW - CHARACTER_SIZE, e.x));
                            e.y = Math.max(CHARACTER_SIZE, Math.min(canvasLogicalH - CHARACTER_SIZE, e.y));
                            // Slow down when near edge
                            e.vx *= 0.95;
                            e.vy *= 0.95;
                            // Remove from game if stopped at edge
                            if (Math.abs(e.vx) < 0.5 && Math.abs(e.vy) < 0.5) {
                                e.isAlive = false;
                            }
                            return;
                        }
                        
                        let target = getClosestEnemy(e);
                        if (target) {
                            const angleToTarget = Math.atan2(target.y - e.y, target.x - e.x);
                            const dist = Math.hypot(target.x - e.x, target.y - e.y);
                            const ds = diffSettings[currentDifficulty];

                            // Cover usage: Find nearest cover when low health
                            let nearCover = null;
                            if (e.health < e.maxHealth * 0.5) {
                                for (const c of coverObjects) {
                                    if (!c.alive) continue;
                                    const coverDist = Math.hypot(c.x - e.x, c.y - e.y);
                                    if (coverDist < 150) {
                                        nearCover = c;
                                        break;
                                    }
                                }
                            }

                            // Flanking behavior: Try to get behind target
                            const flankingAngle = angleToTarget + Math.PI;
                            const flankChance = currentDifficulty === 'hard' ? 0.03 : 0.015;
                            let shouldFlank = Math.random() < flankChance && dist > 100;

                            // Improved AI: Strafing behavior
                            const strafeAngle = angleToTarget + Math.PI / 2;
                            const strafeDir = Math.sin(now * 0.003 + e.x * 0.01) > 0 ? 1 : -1;
                            
                            // Improved AI: Predictive shooting
                            let targetX = target.x;
                            let targetY = target.y;
                            if (dist > 100) {
                                // Predict where target will be based on their velocity
                                const bulletTime = dist / e.weaponConfig.speed;
                                targetX += target.vx * bulletTime * 0.5;
                                targetY += target.vy * bulletTime * 0.5;
                            }
                            const predictedAngle = Math.atan2(targetY - e.y, targetX - e.x);

                            // Movement logic with strafing, flanking, and cover
                            if (nearCover && e.health < e.maxHealth * 0.4) {
                                // Move toward cover
                                const coverAngle = Math.atan2(nearCover.y - e.y, nearCover.x - e.x);
                                e.x += Math.cos(coverAngle) * (PLAYER_SPEED * ds.aiSpeed) * tickScale;
                                e.y += Math.sin(coverAngle) * (PLAYER_SPEED * ds.aiSpeed) * tickScale;
                            } else if (shouldFlank) {
                                // Flank around target
                                e.x += Math.cos(flankingAngle) * (PLAYER_SPEED * ds.aiSpeed * 0.8) * tickScale;
                                e.y += Math.sin(flankingAngle) * (PLAYER_SPEED * ds.aiSpeed * 0.8) * tickScale;
                            } else if (dist > 120) {
                                // Move toward target with strafe
                                e.x += (Math.cos(predictedAngle) * 0.7 + Math.cos(strafeAngle) * strafeDir * 0.3) * (PLAYER_SPEED * ds.aiSpeed) * tickScale;
                                e.y += (Math.sin(predictedAngle) * 0.7 + Math.sin(strafeAngle) * strafeDir * 0.3) * (PLAYER_SPEED * ds.aiSpeed) * tickScale;
                            } else if (dist < 80) {
                                // Back away while strafing
                                e.x -= (Math.cos(predictedAngle) * 0.6 - Math.cos(strafeAngle) * strafeDir * 0.4) * (PLAYER_SPEED * ds.aiSpeed * 0.8) * tickScale;
                                e.y -= (Math.sin(predictedAngle) * 0.6 - Math.sin(strafeAngle) * strafeDir * 0.4) * (PLAYER_SPEED * ds.aiSpeed * 0.8) * tickScale;
                            } else {
                                // Pure strafe at optimal range
                                e.x += Math.cos(strafeAngle) * strafeDir * (PLAYER_SPEED * ds.aiSpeed * 0.5) * tickScale;
                                e.y += Math.sin(strafeAngle) * strafeDir * (PLAYER_SPEED * ds.aiSpeed * 0.5) * tickScale;
                            }

                            // Improved AI: Dodge behavior when low health
                            if (e.health < e.maxHealth * 0.4 && now > e.dodgeCooldown && Math.random() < 0.02) {
                                e.isDodging = true;
                                e.dodgeEnd = now + 150;
                                e.dodgeCooldown = now + 2000;
                                spawnDodgeFlash(e);
                                
                                const dodgeAngle = angleToTarget + (Math.random() - 0.5) * Math.PI;
                                e.vx += Math.cos(dodgeAngle) * 8;
                                e.vy += Math.sin(dodgeAngle) * 8;
                            }

                            if (e.isDodging && now > e.dodgeEnd) {
                                e.isDodging = false;
                            }

                            // Shooting with reduced deviation for harder difficulties
                            const ammoBoostActive = now < e.ammoBoostUntil;
                            const effectiveCooldown = ammoBoostActive ? 0 : e.weaponConfig.cooldown;
                            if (now - e.lastShotTime > effectiveCooldown) {
                                let deviation = (Math.random() - 0.5) * ds.aiSpread;
                                if (['lightsaber', 'darksaber', 'staff', 'wrench'].includes(e.weaponConfig.key)) {
                                    deviation = 0;
                                }
                                
                                // Use predicted angle for better accuracy on harder difficulties
                                const baseAngle = currentDifficulty === 'hard' ? predictedAngle : angleToTarget;
                                const deviatedAngle = baseAngle + deviation;
                                const dx = Math.cos(deviatedAngle) * e.weaponConfig.speed;
                                const dy = Math.sin(deviatedAngle) * e.weaponConfig.speed;
                                if (bullets.length < MAX_BULLETS) bullets.push(new Projectile(e.x, e.y, dx, dy, e.weaponConfig, e));
                                e.lastShotTime = now;

                                // ── SFX: AI shoot sounds ───────────────
                                const wk = e.weaponConfig.key;
                                if (wk === 'blaster') playSound('blasterShot', 60);
                                else if (wk === 'bowcaster') playSound('bowcasterShot', 100);
                                else if (wk === 'lightning') playSound('forceLightning', 200);
                                else if (wk === 'zap') playSound('zap', 450);
                                else if (e.weaponConfig.returnable) playSound('lightsaberThrow', 300);
                            }
                        }
                    }

                    // Apply knockback velocity (decay matched to TARGET_FPS)
                    const kbDecay = Math.pow(0.78, tickScale);
                    e.x += e.vx * tickScale; e.y += e.vy * tickScale;
                    e.vx *= kbDecay; e.vy *= kbDecay;
                    if (Math.abs(e.vx) < 0.05) e.vx = 0;
                    if (Math.abs(e.vy) < 0.05) e.vy = 0;

                    // Cover push-out
                    checkEntityCoverCollision(e, tickScale);

                    e.x = Math.max(CHARACTER_SIZE, Math.min(canvasLogicalW - CHARACTER_SIZE, e.x));
                    e.y = Math.max(CHARACTER_SIZE, Math.min(canvasLogicalH - CHARACTER_SIZE, e.y));
                });

                if (specialTatooineJabbaSpawned && specialTatooineJabbaCharacter && specialTatooineJabbaCharacter.isAlive && Date.now() > specialTatooineGuardTimer) {
                    spawnGamorreanGuard();
                    specialTatooineGuardTimer = Date.now() + 2200;
                }

                bullets.forEach(b => b.step(tickScale));

                const BLOCK_RADIUS = 12;
                const BLOCK_CHANCE = 0.4; // 40% chance to block on collision
                const blockNow = Date.now();
                for (let i = 0; i < bullets.length; i++) {
                    for (let j = i + 1; j < bullets.length; j++) {
                        const a = bullets[i], b = bullets[j];
                        if (a.blocked || b.blocked) continue;
                        if (!a.owner || !b.owner) continue;
                        if (a.owner.team === b.owner.team) continue;
                        if (a.type !== b.type) continue;
                        // Skip if either bullet is in pass-through immunity
                        if ((a.noCollideUntil || 0) > blockNow || (b.noCollideUntil || 0) > blockNow) continue;

                        if (Math.hypot(a.x - b.x, a.y - b.y) < BLOCK_RADIUS) {
                            if (Math.random() < BLOCK_CHANCE) {
                                // Block both bullets
                                a.blocked = true;
                                b.blocked = true;
                                for (let k = 0; k < 8; k++) {
                                    const sparkAngle = Math.random() * Math.PI * 2;
                                    const speed = Math.random() * 3 + 1;
                                    if (clashParticles.length < 120) clashParticles.push({
                                        x: (a.x + b.x) / 2, y: (a.y + b.y) / 2,
                                        dx: Math.cos(sparkAngle) * speed, dy: Math.sin(sparkAngle) * speed,
                                        life: 18, maxLife: 18,
                                        color: a.type === 'zap' ? '#7efcff' : '#ffaa00'
                                    });
                                }
                            } else {
                                // Pass through — grant immunity so they don't re-collide next frame
                                a.noCollideUntil = blockNow + 350;
                                b.noCollideUntil = blockNow + 350;
                            }
                        }
                    }
                }

                const hitTargets = entities.filter(e => e.isAlive);
                bullets = bullets.filter(b => {
                    if (b.blocked) return false;
                    if (!b.owner) return false;
                    if (b.collected) return false;
                    if (b.returnable && b.owner && !b.owner.isAlive) return false;

                    // Cover collision
                    if (checkBulletCoverCollision(b)) {
                        if (b.returnable && !b.returning) {
                            b.returning = true;
                            return true;
                        }
                        if (b.returnable && b.returning) {
                            return true;
                        }
                        return false;
                    }

                    let hit = false;
                    
                    for (let i = 0; i < hitTargets.length; i++) {
                        let target = hitTargets[i];
                        if (!target.isAlive) continue;
                        if (b.owner.team !== target.team) {
                            if (Math.hypot(b.x - target.x, b.y - target.y) < CHARACTER_SIZE) {
                                if (b.returnable && !b.returning) {
                                    // Outgoing: hit enemy, start returning (no damage yet, handled below)
                                    applyStatusAndDamage(target, b);
                                    b.returning = true;
                                    break;
                                }
                                if (b.returnable && b.returning) {
                                    // Return trip: hit enemy again — deal damage but keep flying back to owner
                                    applyStatusAndDamage(target, b);
                                    break;
                                }
                                if (!b.returnable) {
                                    applyStatusAndDamage(target, b);
                                    hit = true;
                                    break;
                                }
                            }
                        }
                    }
                    if (hit) return false;
                    if (b.returnable && !b.returning && (b.x <= -30 || b.x >= canvasLogicalW + 30 || b.y <= -30 || b.y >= canvasLogicalH + 30)) {
                        b.returning = true;
                        return true;
                    }
                    if (b.returnable && b.returning) return true;
                    return b.x > -30 && b.x < canvasLogicalW + 30 && b.y > -30 && b.y < canvasLogicalH + 30;
                });

                // ── ARENA-SPECIFIC MECHANICS ───────────────────────────────
                const now = Date.now();

                // Pickup spawning system
                if (gameStartTime > 0) {
                    pickupSpawnTimer += 16.7 * tickScale;
                    if (pickupSpawnTimer >= PICKUP_SPAWN_TIME && pickups.length === 0) {
                        pickupSpawnTimer = 0;
                        // Spawn a pickup in a random cover-free spot
                        const type = PICKUP_TYPES[Math.floor(Math.random() * PICKUP_TYPES.length)];
                        let validSpot = false;
                        let attempts = 0;
                        let px, py;
                        
                        while (!validSpot && attempts < 50) {
                            px = CHARACTER_SIZE + 50 + Math.random() * (canvasLogicalW - CHARACTER_SIZE * 2 - 100);
                            py = CHARACTER_SIZE + 50 + Math.random() * (canvasLogicalH - CHARACTER_SIZE * 2 - 100);
                            
                            // Check if spot is free of cover
                            validSpot = true;
                            for (const c of coverObjects) {
                                if (!c.alive) continue;
                                const dist = Math.hypot(c.x - px, c.y - py);
                                if (dist < c.w/2 + 30) {
                                    validSpot = false;
                                    break;
                                }
                            }
                            attempts++;
                        }
                        
                        if (validSpot) {
                            pickups.push({
                                x: px,
                                y: py,
                                type: type,
                                spawnTime: now
                            });
                        }
                    }
                }

                // Pickup collision detection
                pickups = pickups.filter(p => {
                    const pickupRadius = 20;
                    for (const e of aliveEntities) {
                        if (Math.hypot(e.x - p.x, e.y - p.y) < pickupRadius + CHARACTER_SIZE) {
                            // Apply pickup effect
                            if (p.type === 'health') {
                                e.health = Math.min(e.maxHealth, e.health + 25);
                                spawnHitSparks(e.x, e.y, '#00ff00', 10);
                            } else if (p.type === 'shield') {
                                e.shieldActive = true;
                                e.shieldUntil = now + 10000; // Shield lasts 10 seconds
                                spawnHitSparks(e.x, e.y, '#00aaff', 10);
                            } else if (p.type === 'ammo') {
                                e.ammoBoostUntil = now + 4000; // Ammo boost lasts 4 seconds
                                spawnHitSparks(e.x, e.y, '#ffaa00', 10);
                            }
                            return false; // Remove pickup
                        }
                    }
                    return true; // Keep pickup
                });

                // Hoth: Periodic wind gusts that push both fighters
                if (currentArena === 'hoth') {
                    if (!hothWindGustActive) {
                        hothWindGustTimer += 16.7 * tickScale;
                        if (hothWindGustTimer > 5000) { // Wind gust every 5 seconds
                            hothWindGustActive = true;
                            hothWindGustTimer = 0;
                            hothWindGustDirection = Math.random() > 0.5 ? 1 : -1; // Random horizontal direction
                            setTimeout(() => { hothWindGustActive = false; }, 1500); // Gust lasts 1.5 seconds
                        }
                    }
                    if (hothWindGustActive) {
                        const windStrength = 3;
                        aliveEntities.forEach(e => {
                            e.vx += hothWindGustDirection * windStrength * tickScale;
                        });
                    }
                }

                // Death Star: Superlaser beam every 20 seconds
                if (currentArena === 'deathstar') {
                    if (!deathStarSuperlaserActive) {
                        deathStarSuperlaserTimer += 16.7 * tickScale;
                        if (deathStarSuperlaserTimer > 20000) { // Every 20 seconds
                            deathStarSuperlaserActive = true;
                            deathStarSuperlaserTimer = 0;
                            deathStarSuperlaserProgress = 0;
                            deathStarSuperlaserY = Math.random() * (canvasLogicalH - 200) + 100;
                            triggerScreenShake(8, 15);
                        }
                    }
                    if (deathStarSuperlaserActive) {
                        deathStarSuperlaserProgress += 0.02 * tickScale;
                        if (deathStarSuperlaserProgress >= 1) {
                            deathStarSuperlaserActive = false;
                        }
                        // Damage entities in the beam path
                        const beamY = deathStarSuperlaserY;
                        const beamHeight = 30;
                        aliveEntities.forEach(e => {
                            if (e.y > beamY - beamHeight/2 && e.y < beamY + beamHeight/2) {
                                const lastDamage = deathStarSuperlaserDamage.get(e) || 0;
                                if (now - lastDamage > 100) {
                                    e.updateHealth(15);
                                    deathStarSuperlaserDamage.set(e, now);
                                    spawnHitSparks(e.x, e.y, '#00ff00', 10);
                                }
                            }
                        });
                    }
                }

                const clashDrag = Math.pow(0.85, tickScale);
                clashParticles = clashParticles.filter(p => {
                    p.x += p.dx * tickScale; p.y += p.dy * tickScale;
                    p.dx *= clashDrag; p.dy *= clashDrag;
                    p.life -= tickScale;
                    return p.life > 0;
                });
            }

            function draw(tickScale) {
                ctx.setTransform(canvasDpr, 0, 0, canvasDpr, 0, 0);
                ctx.clearRect(0, 0, canvasLogicalW, canvasLogicalH);

                // Apply screen shake
                ctx.save();
                applyScreenShake();

                // ── Arena background ───────────────────────────────────
                const arenaStyle = ARENAS[currentArena] || ARENAS.space;
                arenaStyle.bg(canvasLogicalW, canvasLogicalH, tickScale);

                // ── Space arena: animated starfield ───────────────────
                if (currentArena === 'space') {
                    starLayers.forEach(layer => {
                        layer.stars.forEach(st => {
                            st.x -= layer.speed * tickScale;
                            if (st.x < 0) { st.x = canvasLogicalW; st.y = Math.random() * canvasLogicalH; }
                            st.twinkle += 0.04 * tickScale;
                            const alpha = layer.alpha * (0.7 + 0.3 * Math.sin(st.twinkle));
                            ctx.fillStyle = `rgba(255,255,255,${alpha})`;
                            ctx.beginPath(); ctx.arc(st.x, st.y, layer.size, 0, Math.PI * 2); ctx.fill();
                        });
                    });
                }

                // subtle grid
                ctx.strokeStyle = arenaStyle.grid;
                ctx.lineWidth = 1;
                for (let i = 0; i < canvasLogicalW; i += 40) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, canvasLogicalH); ctx.stroke(); }
                for (let i = 0; i < canvasLogicalH; i += 40) { ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(canvasLogicalW, i); ctx.stroke(); }

                // ── Pickups ───────────────────────────────────────────────
                pickups.forEach(p => {
                    ctx.save();
                    const pulse = Math.sin(Date.now() * 0.005) * 0.2 + 0.8;
                    
                    if (p.type === 'health') {
                        ctx.fillStyle = `rgba(0, 255, 0, ${pulse})`;
                        ctx.shadowBlur = 15;
                        ctx.shadowColor = '#00ff00';
                        ctx.beginPath();
                        ctx.arc(p.x, p.y, 15, 0, Math.PI * 2);
                        ctx.fill();
                        // Cross
                        ctx.strokeStyle = '#ffffff';
                        ctx.lineWidth = 3;
                        ctx.beginPath();
                        ctx.moveTo(p.x - 8, p.y);
                        ctx.lineTo(p.x + 8, p.y);
                        ctx.moveTo(p.x, p.y - 8);
                        ctx.lineTo(p.x, p.y + 8);
                        ctx.stroke();
                    } else if (p.type === 'shield') {
                        ctx.fillStyle = `rgba(0, 170, 255, ${pulse})`;
                        ctx.shadowBlur = 15;
                        ctx.shadowColor = '#00aaff';
                        ctx.beginPath();
                        ctx.arc(p.x, p.y, 15, 0, Math.PI * 2);
                        ctx.fill();
                        // Shield icon
                        ctx.strokeStyle = '#ffffff';
                        ctx.lineWidth = 3;
                        ctx.beginPath();
                        ctx.arc(p.x, p.y, 10, Math.PI, 0);
                        ctx.lineTo(p.x + 10, p.y + 5);
                        ctx.lineTo(p.x - 10, p.y + 5);
                        ctx.closePath();
                        ctx.stroke();
                    } else if (p.type === 'ammo') {
                        ctx.fillStyle = `rgba(255, 170, 0, ${pulse})`;
                        ctx.shadowBlur = 15;
                        ctx.shadowColor = '#ffaa00';
                        ctx.beginPath();
                        ctx.arc(p.x, p.y, 15, 0, Math.PI * 2);
                        ctx.fill();
                        // Lightning bolt
                        ctx.strokeStyle = '#ffffff';
                        ctx.lineWidth = 3;
                        ctx.beginPath();
                        ctx.moveTo(p.x + 5, p.y - 10);
                        ctx.lineTo(p.x - 5, p.y);
                        ctx.lineTo(p.x, p.y);
                        ctx.lineTo(p.x - 5, p.y + 10);
                        ctx.lineTo(p.x + 5, p.y);
                        ctx.lineTo(p.x, p.y);
                        ctx.closePath();
                        ctx.stroke();
                    }
                    ctx.restore();
                });

                // ── Arena-specific visual effects ────────────────────────
                // Hoth: Wind gust indicator
                if (currentArena === 'hoth' && hothWindGustActive) {
                    ctx.save();
                    ctx.globalAlpha = 0.3;
                    ctx.fillStyle = 'rgba(200, 230, 255, 0.4)';
                    const windArrowX = hothWindGustDirection > 0 ? 100 : canvasLogicalW - 100;
                    const windArrowDir = hothWindGustDirection > 0 ? 1 : -1;
                    // Draw wind arrows
                    for (let i = 0; i < 5; i++) {
                        const y = 100 + i * 120;
                        ctx.beginPath();
                        ctx.moveTo(windArrowX, y);
                        ctx.lineTo(windArrowX + 60 * windArrowDir, y);
                        ctx.lineTo(windArrowX + 45 * windArrowDir, y - 15);
                        ctx.moveTo(windArrowX + 60 * windArrowDir, y);
                        ctx.lineTo(windArrowX + 45 * windArrowDir, y + 15);
                        ctx.strokeStyle = 'rgba(200, 230, 255, 0.6)';
                        ctx.lineWidth = 3;
                        ctx.stroke();
                    }
                    ctx.restore();
                }

                // Death Star: Superlaser beam
                if (currentArena === 'deathstar' && deathStarSuperlaserActive) {
                    const beamY = deathStarSuperlaserY;
                    const beamHeight = 30;
                    const beamWidth = canvasLogicalW * deathStarSuperlaserProgress;
                    
                    ctx.save();
                    // Main beam
                    const gradient = ctx.createLinearGradient(0, beamY - beamHeight/2, 0, beamY + beamHeight/2);
                    gradient.addColorStop(0, 'rgba(0, 255, 0, 0)');
                    gradient.addColorStop(0.5, 'rgba(0, 255, 0, 0.8)');
                    gradient.addColorStop(1, 'rgba(0, 255, 0, 0)');
                    ctx.fillStyle = gradient;
                    ctx.fillRect(0, beamY - beamHeight/2, beamWidth, beamHeight);
                    
                    // Beam core
                    ctx.fillStyle = 'rgba(200, 255, 200, 0.9)';
                    ctx.fillRect(0, beamY - 3, beamWidth, 6);
                    
                    // Glow effect
                    ctx.shadowBlur = 30;
                    ctx.shadowColor = '#00ff00';
                    ctx.strokeStyle = 'rgba(0, 255, 0, 0.5)';
                    ctx.lineWidth = 2;
                    ctx.strokeRect(0, beamY - beamHeight/2, beamWidth, beamHeight);
                    ctx.restore();
                }

                // ── Cover objects ──────────────────────────────────────
                drawCovers();

                entities.forEach(e => {
                    if (e.isAlive) e.draw(getClosestEnemy(e));
                });
                
                bullets.forEach(b => b.draw());

                // clash particles
                clashParticles.forEach(p => {
                    if (p.life <= 0) return;
                    ctx.save();
                    ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
                    ctx.fillStyle = p.color;
                    ctx.shadowBlur = 6;
                    ctx.shadowColor = p.color;
                    ctx.beginPath(); ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2); ctx.fill();
                    ctx.restore();
                });

                // death explosion particles
                const deathDrag = Math.pow(0.88, tickScale);
                deathParticles = deathParticles.filter(p => {
                    p.x += p.dx * tickScale; p.y += p.dy * tickScale;
                    p.dx *= deathDrag; p.dy *= deathDrag;
                    p.life -= tickScale;
                    if (p.life <= 0) return false;
                    
                    ctx.save();
                    ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
                    ctx.fillStyle = p.color;
                    ctx.shadowBlur = 8; ctx.shadowColor = p.color;
                    ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(0, p.r * (p.life / p.maxLife)), 0, Math.PI * 2); ctx.fill();
                    ctx.restore();
                    return true;
                });

                // floating damage numbers
                const floatDrag = Math.pow(0.96, tickScale);
                floatNums = floatNums.filter(fn => {
                    fn.y += fn.dy * tickScale;
                    fn.dy *= floatDrag;
                    fn.life -= tickScale;
                    if (fn.life <= 0) return false;
                    
                    const alpha = Math.max(0, fn.life / fn.maxLife);
                    ctx.save();
                    ctx.globalAlpha = alpha;
                    ctx.font = `bold ${Math.round(11 + (1 - alpha) * 4)}px Orbitron, sans-serif`;
                    ctx.textAlign = 'center';
                    ctx.fillStyle = '#ffffff';
                    ctx.shadowBlur = 6; ctx.shadowColor = '#ff4444';
                    ctx.fillText(fn.text, fn.x, fn.y);
                    ctx.restore();
                    return true;
                });

                // ── NEW VISUAL EFFECTS ──────────────────────────────────
                drawSaberTrails();
                drawHitSparks();
                drawImpactParticles();
                drawDodgeFlashes();
                drawLowHealthVignette();

                // ── BOWCASTER CHARGE INDICATOR ─────────────────────────
                if (bowcasterCharging && mainPlayer && mainPlayer.isAlive && bowcasterCharge > 0) {
                    const p = mainPlayer;
                    const r = CHARACTER_SIZE + 8 + bowcasterCharge * 10;
                    const arcEnd = -Math.PI / 2 + bowcasterCharge * Math.PI * 2;
                    ctx.save();
                    // Track glow
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, r, -Math.PI / 2, arcEnd);
                    ctx.strokeStyle = bowcasterCharge >= 0.99 ? '#ffffff' : '#33ff33';
                    ctx.lineWidth = 4;
                    ctx.shadowBlur = 18;
                    ctx.shadowColor = bowcasterCharge >= 0.99 ? '#aaffaa' : '#33ff33';
                    ctx.globalAlpha = 0.55 + bowcasterCharge * 0.45;
                    ctx.stroke();
                    // Pulsing dot at tip
                    const tipX = p.x + Math.cos(arcEnd) * r;
                    const tipY = p.y + Math.sin(arcEnd) * r;
                    ctx.beginPath();
                    ctx.arc(tipX, tipY, 3 + bowcasterCharge * 3, 0, Math.PI * 2);
                    ctx.fillStyle = '#33ff33';
                    ctx.shadowBlur = 20;
                    ctx.globalAlpha = 1;
                    ctx.fill();
                    // Charge label when nearly full
                    if (bowcasterCharge >= 0.9) {
                        ctx.fillStyle = '#ffffff';
                        ctx.font = '10px Orbitron';
                        ctx.textAlign = 'center';
                        ctx.fillText('CHARGED', p.x, p.y - CHARACTER_SIZE - 15);
                    }
                    ctx.restore();
                }

                // ── COMPUTER CHARGE INDICATOR ─────────────────────────
                if (computerCharging && mainPlayer && mainPlayer.isAlive && computerCharge > 0) {
                    const p = mainPlayer;
                    const r = CHARACTER_SIZE + 8 + computerCharge * 10;
                    const arcEnd = -Math.PI / 2 + computerCharge * Math.PI * 2;
                    ctx.save();
                    // Track glow
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, r, -Math.PI / 2, arcEnd);
                    ctx.strokeStyle = computerCharge >= 0.99 ? '#ffffff' : '#808080';
                    ctx.lineWidth = 4;
                    ctx.shadowBlur = 18;
                    ctx.shadowColor = computerCharge >= 0.99 ? '#aaaaaa' : '#808080';
                    ctx.globalAlpha = 0.55 + computerCharge * 0.45;
                    ctx.stroke();
                    // Pulsing dot at tip
                    const tipX = p.x + Math.cos(arcEnd) * r;
                    const tipY = p.y + Math.sin(arcEnd) * r;
                    ctx.beginPath();
                    ctx.arc(tipX, tipY, 3 + computerCharge * 3, 0, Math.PI * 2);
                    ctx.fillStyle = '#808080';
                    ctx.shadowBlur = 20;
                    ctx.globalAlpha = 1;
                    ctx.fill();
                    // Charge label when nearly full
                    if (computerCharge >= 0.9) {
                        ctx.fillStyle = '#ffffff';
                        ctx.font = '10px Orbitron';
                        ctx.textAlign = 'center';
                        ctx.fillText('CHARGED', p.x, p.y - CHARACTER_SIZE - 15);
                    }
                    ctx.restore();
                }

                // Restore screen shake transform
                ctx.restore();
            }

            function hpColor(pct) {
                if (pct > 0.5) {
                    const t = (pct - 0.5) / 0.5;
                    const r = Math.round(255 * (1-t)), g = 255, b = 0;
                    return `rgb(${r},${g},${b})`;
                } else {
                    const t = pct / 0.5;
                    const r = 255, g = Math.round(255 * t), b = 0;
                    return `rgb(${r},${g},${b})`;
                }
            }

            function updateHUD() {
                const pPct = mainPlayer.health / mainPlayer.maxHealth;
                const ePct = mainEnemy.health / mainEnemy.maxHealth;
                playerHealthBar.style.width = `${pPct * 100}%`;
                playerHealthBar.style.backgroundColor = hpColor(pPct);
                enemyHealthBar.style.width = `${ePct * 100}%`;
                enemyHealthBar.style.backgroundColor = hpColor(ePct);
                playerHealthText.textContent = `HP: ${Math.round(mainPlayer.health)}`;
                enemyHealthText.textContent = `HP: ${Math.round(mainEnemy.health)}`;

                const timerEl = document.getElementById('hudTimer');
                if (timerEl && timerEl.style.display !== 'none') {
                    const rs = Math.max(0, Math.floor(roundTimeRemaining));
                    const m = Math.floor(rs / 60);
                    const s = rs % 60;
                    timerEl.textContent = `${m}:${s.toString().padStart(2, '0')}`;
                    if (rs <= 30) timerEl.classList.add('sudden-death');
                    else timerEl.classList.remove('sudden-death');
                }

                const renderSubBars = (teamStr, containerId) => {
                    const container = document.getElementById(containerId);
                    container.innerHTML = '';
                    const backups = entities.filter(e => e.team === teamStr && !e.isMainEntity && e.isAlive);
                    backups.forEach(b => {
                        const wrapper = document.createElement('div');
                        wrapper.style.flex = '1';
                        wrapper.style.backgroundColor = '#111';
                        wrapper.style.borderRadius = '3px';
                        wrapper.style.border = '1px solid #444';
                        wrapper.style.overflow = 'hidden';
                        const bar = document.createElement('div');
                        bar.style.height = '100%';
                        const pct = b.health / b.maxHealth;
                        bar.style.backgroundColor = hpColor(pct);
                        bar.style.width = `${pct * 100}%`;
                        wrapper.appendChild(bar);
                        container.appendChild(wrapper);
                    });
                };

                renderSubBars('player', 'playerSubBars');
                renderSubBars('enemy', 'enemySubBars');
            }

            function saveMatchHistory(playerWon) {
                try {
                    const history = JSON.parse(localStorage.getItem('galacticDuelHistory') || '[]');
                    history.unshift({
                        date: new Date().toLocaleDateString(),
                        player: pCharData ? pCharData.name : '?',
                        enemy: eCharData ? eCharData.name : '?',
                        result: playerWon ? 'W' : 'L',
                        difficulty: currentDifficulty,
                        damage: playerDamageDealt,
                        accuracy: playerShotsFired > 0 ? Math.round((playerHitsLanded / playerShotsFired) * 100) : null
                    });
                    if (history.length > MAX_HISTORY_ENTRIES) history.pop();
                    localStorage.setItem('galacticDuelHistory', JSON.stringify(history));

                    // Show streak banner and check achievements
                    let streak = 0;
                    for (const h of history) { if (h.result === 'W') streak++; else break; }
                    const banner = document.getElementById('streakBanner');
                    if (streak >= 2 && playerWon) {
                        banner.textContent = `🔥 ${streak}-WIN STREAK`;
                        banner.style.display = 'block';
                        setTimeout(() => { banner.style.display = 'none'; }, 3500);
                    }
                    
                    // Win streak achievements
                    if (streak >= 3) tryUnlockAchievement('winStreak3');
                    if (streak >= 5) tryUnlockAchievement('winStreak5');
                    if (streak >= 10) tryUnlockAchievement('winStreak10');
                } catch(e) {}
            }

            function updateRoundPips() {
                const render = (containerId, wins, color) => {
                    const container = document.getElementById(containerId);
                    if (!container) return;
                    container.innerHTML = '';
                    container.style.color = color;
                    for (let i = 0; i < SERIES_WINS_NEEDED; i++) {
                        const pip = document.createElement('div');
                        pip.className = 'round-pip' + (i < wins ? ' won' : '');
                        container.appendChild(pip);
                    }
                };
                if (pCharData) render('playerPips', playerWins, pCharData.color);
                if (eCharData) render('enemyPips', enemyWins, eCharData.color);
            }

            function endGame(message, color) {
                lastGameFrameTime = 0;
                cancelAnimationFrame(gameLoopId);
                document.getElementById('hudTimer').style.display = 'none';

                // ── SFX: stop all sounds on round end ──────────────────
                stopAllSfx();

                const playerWon = (color === '#00A4FF');
                if (playerWon) playerWins++; else enemyWins++;
                updateRoundPips();
                saveMatchHistory(playerWon);

                // ── Achievement checks ─────────────────────────────────
                if (playerWon) {
                    totalWins++;
                    if (totalWins === 1) tryUnlockAchievement('firstWin');
                    if (eCharData && eCharData.isDroid) tryUnlockAchievement('droidSlayer');
                    if (currentArena === 'hoth') tryUnlockAchievement('hothSurvivor');
                    if (!playerTookDamage) tryUnlockAchievement('noHits');
                    if (!playerTookDamage) tryUnlockAchievement('perfectVictory');
                    arenasWonIn.add(currentArena);
                    if (arenasWonIn.size >= 5) tryUnlockAchievement('arenaExplorer');
                    if (eCharData) {
                        villainsDefeated.add(eCharData.id);
                        if (villainsDefeated.size >= 5) tryUnlockAchievement('villainSlayer');
                        if (eCharData.id === 'vader') tryUnlockAchievement('vaderSlayer');
                    }
                    if (pCharData && BOUNTY_HUNTER_IDS.has(pCharData.id)) tryUnlockAchievement('bountyHunter');
                    if (pCharData && pCharData.id === 'han') {
                        hanWinCount++;
                        if (hanWinCount >= 3) tryUnlockAchievement('millenniumRun');
                    }
                    const saberWeapons = ['lightsaber','darksaber'];
                    if (pCharData && saberWeapons.includes(pCharData.weapon)) {
                        saberWinCount++;
                        if (saberWinCount >= 3) tryUnlockAchievement('saberMaster');
                        saberWinCount2++;
                        if (saberWinCount2 >= 5) tryUnlockAchievement('saberMaster2');
                    }
                    if (pCharData && pCharData.weapon === 'blaster') {
                        blasterWinCount++;
                        if (blasterWinCount >= 5) tryUnlockAchievement('blasterMaster');
                    }
                    if (currentArena === 'space') {
                        spaceWinCount++;
                        if (spaceWinCount >= 5) tryUnlockAchievement('spaceSpecialist');
                    }
                    
                    // Vader consecutive wins tracking
                    if (pCharData && pCharData.id === 'vader') {
                        if (lastPlayedCharacterId === 'vader') {
                            vaderConsecutiveWins++;
                        } else {
                            vaderConsecutiveWins = 1;
                        }
                        if (vaderConsecutiveWins >= 10) {
                            tryUnlockAchievement('vaderConquest');
                        }
                    } else {
                        vaderConsecutiveWins = 0;
                    }
                    lastPlayedCharacterId = pCharData ? pCharData.id : null;
                    
                    persistAchievementCounters();
                    
                    // Tatooine unlock: Boba Fett vs Anakin in Mos Eisley
                    if (pCharData && eCharData && currentArena === 'moseisley' && !gameUnlocks.tatooineArena) {
                        if (pCharData.id === 'bobafett' && eCharData.id === 'anakin') {
                            gameUnlocks.tatooineArena = true;
                            persistGalacticUnlocks();
                            tryUnlockAchievement('tatooineUnlock');
                            document.getElementById('tatooineArenaBtn').style.display = 'inline-block';
                            showAnnouncement("You defeated Anakin as Boba Fett in Mos Eisley! Tatooine arena is now unlocked!", "#c9a066", 5500, "🌞 ARENA UNLOCKED");
                        }
                    }

                    // Senator Palpatine unlock: Win as Darth Maul vs Qui-Gon (randomly assigned) on Naboo
                    if (pCharData && eCharData && currentArena === 'naboo' && seriesEnemyFromRandom && !gameUnlocks.senatorPalpatine) {
                        if (pCharData.id === 'maul' && eCharData.id === 'quigon') {
                            gameUnlocks.senatorPalpatine = true;
                            persistGalacticUnlocks();
                            rebuildSecretRoster();
                            updateSecretFactionSectionVisibility();
                            showAnnouncement("You struck down Qui-Gon as Darth Maul on Naboo... just as the Sith planned. Senator Palpatine has joined your roster!", "#c8a84b", 6000, "🔓 CHARACTER UNLOCKED");
                        }
                    }

                }

                // Senator Palpatine unlock (defeat path): Lose as Qui-Gon vs Darth Maul (randomly assigned) on Naboo
                if (!playerWon && pCharData && eCharData && currentArena === 'naboo' && seriesEnemyFromRandom && !gameUnlocks.senatorPalpatine) {
                    if (pCharData.id === 'quigon' && eCharData.id === 'maul') {
                        gameUnlocks.senatorPalpatine = true;
                        persistGalacticUnlocks();
                        rebuildSecretRoster();
                        updateSecretFactionSectionVisibility();
                        showAnnouncement("Qui-Gon has fallen on Naboo... Senator Palpatine has joined your roster!", "#c8a84b", 6000, "🔓 CHARACTER UNLOCKED");
                    }
                }

                const seriesOver = playerWins >= SERIES_WINS_NEEDED || enemyWins >= SERIES_WINS_NEEDED;
                const nextRoundBtn = document.getElementById('nextRoundButton');
                const rematchBtn   = document.getElementById('rematchButton');
                const seriesDisplay = document.getElementById('seriesScoreDisplay');

                if (seriesOver) {
                    nextRoundBtn.style.display = 'none';
                    rematchBtn.style.display = 'inline-block';
                    const finalMsg = playerWins >= SERIES_WINS_NEEDED ? '★ SERIES VICTORY ★' : '✗ SERIES DEFEAT';
                    messageText.textContent = finalMsg;
                    seriesDisplay.textContent = `FINAL: ${playerWins} — ${enemyWins}`;

                    // Award credits for winning series
                    if (playerWins >= SERIES_WINS_NEEDED) {
                        let creditsEarned = 10; // Default credits per series

                        // Calculate bonus credits based on opponent strength in freeplay
                        if (pCharData && eCharData) {
                            const playerHP = pCharData.hp;
                            const enemyHP = eCharData.hp;
                            const strengthRatio = enemyHP / playerHP;

                            // Bonus credits for stronger opponents
                            if (strengthRatio > 1.5) {
                                creditsEarned += 15; // Very strong opponent
                            } else if (strengthRatio > 1.2) {
                                creditsEarned += 10; // Strong opponent
                            } else if (strengthRatio > 1.0) {
                                creditsEarned += 5; // Slightly stronger opponent
                            }

                            // Difficulty bonus
                            if (currentDifficulty === 'hard') {
                                creditsEarned += 10;
                            } else if (currentDifficulty === 'easy') {
                                creditsEarned = Math.max(5, creditsEarned - 5);
                            }
                        }

                        credits = Math.min(5000, credits + creditsEarned);
                        saveGameSettings();
                        showAnnouncement(`+${creditsEarned} Credits Earned!`, '#ffd700', 3000, 'CREDITS');
                    }
                } else {
                    nextRoundBtn.style.display = 'inline-block';
                    rematchBtn.style.display = 'none';
                    messageText.textContent = message;
                    seriesDisplay.textContent = `SERIES: ${playerWins} — ${enemyWins}`;
                }
                seriesDisplay.style.display = 'block';

                messageText.style.color = color;
                messageText.style.textShadow = `0 0 15px ${color}`;
                document.querySelector('.message-box').style.borderColor = color;

                const elapsed = Math.round((Date.now() - gameStartTime) / 1000);
                const mins = Math.floor(elapsed / 60);
                const secs = elapsed % 60;
                document.getElementById('endTime').textContent = `${mins}:${secs.toString().padStart(2,'0')}`;
                document.getElementById('endKills').textContent = killCount;
                document.getElementById('endHP').textContent = Math.max(0, Math.round(mainPlayer.health * 10) / 10);
                document.getElementById('endTime').style.color = color;
                document.getElementById('endKills').style.color = color;
                document.getElementById('endHP').style.color = color;

                // Post-match round stats
                const accPct = playerShotsFired > 0 ? Math.round((playerHitsLanded / playerShotsFired) * 100) : 0;
                document.getElementById('endDamage').textContent = playerDamageDealt;
                document.getElementById('endHits').textContent = playerHitsLanded;
                document.getElementById('endAccuracy').textContent = playerShotsFired > 0 ? accPct + '%' : '—';
                document.getElementById('endDamage').style.color = color;
                document.getElementById('endHits').style.color = color;
                document.getElementById('endAccuracy').style.color = color;
                
                // Speed Demon achievement check
                if (playerWon && elapsed < 30) {
                    tryUnlockAchievement('speedDemon');
                }

                messageOverlay.style.display = 'flex';
                updateMobileControlsVisibility();
                setTimeout(() => focusFirstVisibleButton(messageOverlay), 0);
            }

            function startTimer() {
                roundTimeRemaining = ROUND_SECONDS;
                const timerEl = document.getElementById('hudTimer');
                timerEl.style.display = 'block';
                timerEl.classList.remove('sudden-death');
                timerEl.textContent = `${Math.floor(ROUND_SECONDS / 60)}:${(ROUND_SECONDS % 60).toString().padStart(2, '0')}`;
            }

            function gameLoop(timeStamp) {
                const ts = timeStamp ?? performance.now();
                const rawDt = lastGameFrameTime ? (ts - lastGameFrameTime) / 1000 : 1 / TARGET_FPS;
                lastGameFrameTime = ts;
                let dt = Math.min(Math.max(rawDt, 0.001), 0.05);
                if (!Number.isFinite(dt)) dt = 1 / TARGET_FPS;

                // Apply slow motion to delta time
                updateSlowMotion(dt);
                if (slowMotion.active) {
                    dt *= slowMotion.scale;
                }

                let tickScale = dt * TARGET_FPS;
                if (!Number.isFinite(tickScale)) tickScale = 1;

                if (!mainPlayer.isAlive) {
                    endGame('DEFEATED', '#FF3333');
                    return;
                }

                if (specialTatooineJabbaSpawned && specialTatooineJabbaCharacter && !specialTatooineJabbaCharacter.isAlive && mainPlayer.isAlive) {
                    if (!gameUnlocks.jabbaUnlock) {
                        tryUnlockAchievement('jabbaUnlock');
                        gameUnlocks.jabbaUnlock = true;
                        persistGalacticUnlocks();
                        rebuildSecretRoster();
                        showAnnouncement('Jabba the Hutt has been defeated and is now playable!', '#a67a1c', 5000, '🔓 CHARACTER UNLOCKED');
                    }
                    endGame('JABBA FALLEN', '#00A4FF');
                    return;
                }
                
                let aliveEnemies = entities.filter(e => e.team === 'enemy' && e.isAlive && !e.hasFled);
                if (aliveEnemies.length === 0) {
                    if (eCharData.id === 'sith_c3po' && !gameUnlocks.secretFaction) {
                        gameUnlocks.secretFaction = true;
                        persistGalacticUnlocks();
                        updateSecretFactionSectionVisibility();
                        rebuildSecretRoster();
                        showAnnouncement("You destroyed Sith C-3PO! The Secret Heroes team and Ultimate Emperor Palpatine are now unlocked!", "#9900ff", 6000, "🔓 FACTION UNLOCKED");
                    }
                    if (pCharData.id === 'obiwan' && currentArena === 'mustafar' && eCharData.id === 'anakin' && seriesEnemyFromRandom) {
                        tryUnlockAchievement('highGround');
                        if (!gameUnlocks.burntAnakin) {
                            gameUnlocks.burntAnakin = true;
                            persistGalacticUnlocks();
                            rebuildSecretRoster();
                            updateSecretFactionSectionVisibility();
                        }
                    }
                    endGame('VICTORY ACHIEVED', '#00A4FF');
                    return;
                }

                if (pCharData && pCharData.id === 'jabba') {
                    if (Date.now() > playableJabbaNextGuard) {
                        if (playableJabbaGuardCount < 6) {
                            spawnPlayableGamorreanGuard();
                            playableJabbaNextGuard = Date.now() + 2200;
                        } else {
                            endGame('JABBA FAILED', '#FF3333');
                            return;
                        }
                    }
                }

                roundTimeRemaining -= dt;
                if (roundTimeRemaining <= 0) {
                    roundTimeRemaining = 0;
                    const pPct = mainPlayer.health / mainPlayer.maxHealth;
                    const ePct = mainEnemy.health / mainEnemy.maxHealth;
                    if (pPct >= ePct) endGame('TIME — VICTORY!', '#00A4FF');
                    else endGame('TIME — DEFEATED', '#FF3333');
                    return;
                }

                try {
                    update(tickScale);
                    draw(tickScale);
                } catch (err) {
                    console.error('Galactic Legends game loop error:', err);
                }
                
                updateHUD();
                gameLoopId = requestAnimationFrame(gameLoop);
            }

            function resizeCanvas() {
                // Use the container's actual rendered size so the logical resolution
                // matches whatever window size the player has.
                const container = canvas.parentElement;
                canvasLogicalW = container.clientWidth  || (window.innerWidth  - 20);
                canvasLogicalH = container.clientHeight || (window.innerHeight - 20);
                
                canvasDpr = Math.min(2, window.devicePixelRatio || 1);
                canvas.width = Math.floor(canvasLogicalW * canvasDpr);
                canvas.height = Math.floor(canvasLogicalH * canvasDpr);
                ctx.setTransform(canvasDpr, 0, 0, canvasDpr, 0, 0);
                
                // Re-seed stars and arena particles to fit the canvas size
                initStars();
                if (ARENAS.hoth._snow) ARENAS.hoth._snow = null;
                if (ARENAS.coruscant._windows) ARENAS.coruscant._windows = null;
                if (ARENAS.naboo._pulses) ARENAS.naboo._pulses = null;
                updateMobileControlsVisibility();
            }

            restartButton.addEventListener('click', () => {
                messageOverlay.style.display = 'none';
                canvas.style.display = 'none';
                hud.style.display = 'none';
                document.getElementById('hudTimer').style.display = 'none';
                opponentMenu.style.display = 'none';
                stopAllSfx();
                showMainMenu();
                selectedPlayerCharId = null;
                playerWins = 0; enemyWins = 0; isNextRound = false;
                deathParticles = [];
                floatNums = [];
                touchMove.active = false;
                touchMove.x = 0;
                touchMove.y = 0;
                touchFire = false;
                if (touchStickKnob) touchStickKnob.style.transform = 'translate(0,0)';
                resizeCanvas();
                updateMobileControlsVisibility();
            });

            document.getElementById('nextRoundButton').addEventListener('click', () => {
                messageOverlay.style.display = 'none';
                updateMobileControlsVisibility();
                isNextRound = true;
                setupGame(seriesPlayerCharId, seriesEnemyCharId);
            });

            document.getElementById('rematchButton').addEventListener('click', () => {
                messageOverlay.style.display = 'none';
                updateMobileControlsVisibility();
                // Start a fresh series with the same matchup and arena
                playerWins = 0; enemyWins = 0; isNextRound = false;
                deathParticles = [];
                floatNums = [];
                setupGame(seriesPlayerCharId, seriesEnemyCharId);
            });

            // ── PAUSE MENU ─────────────────────────────────────────────
            const pauseOverlay   = document.getElementById('pauseOverlay');
            const pauseResumeBtn = document.getElementById('pauseResumeBtn');
            const pauseQuitBtn   = document.getElementById('pauseQuitBtn');
            const pauseBackupBtn = document.getElementById('pauseBackupBtn');

            function isInBattle() {
                return canvas.style.display === 'block'
                    && messageOverlay.style.display !== 'flex';
            }

            function openPauseMenu() {
                if (!isInBattle() || gamePaused) return;
                gamePaused = true;
                cancelAnimationFrame(gameLoopId);
                stopSound('walking');
                pauseBackupBtn.style.display = isDevMenuHost() ? 'block' : 'none';
                pauseOverlay.classList.add('active');
                updateMobileControlsVisibility();
                pauseResumeBtn.focus();
            }

            function closePauseMenu() {
                if (!gamePaused) return;
                gamePaused = false;
                pauseOverlay.classList.remove('active');
                updateMobileControlsVisibility();
                lastGameFrameTime = 0; // prevent huge dt spike after pause
                gameLoopId = requestAnimationFrame(gameLoop);
            }

            function spawnPauseBackup() {
                if (!mainPlayer || !mainPlayer.isAlive || !pCharData) return;

                const isCommander = pCharData.isClone && cloneBackupLeaders.has(pCharData.id);
                let backupName, backupColor, backupUnitId, backupHp;

                if (isCommander) {
                    const info = cloneBackupArmy[pCharData.id];
                    backupUnitId = info.unitId;
                    backupName   = info.name;
                    backupHp     = 50;
                    const cloneCharDef = characters.heroes.find(c => c.id === backupUnitId);
                    backupColor = cloneCharDef ? cloneCharDef.color : pCharData.color;
                } else {
                    backupUnitId = 'stormtrooper';
                    backupName   = 'Stormtrooper';
                    backupColor  = '#ffffff';
                    backupHp     = 80;
                }

                const ds = diffSettings[currentDifficulty];
                const count = ds.alliesCount;

                for (let i = 0; i < count; i++) {
                    const angle = (i / count) * Math.PI * 2 + Math.random() * 0.4;
                    const dist  = 100 + Math.random() * 70;
                    const x = Math.min(canvasLogicalW - CHARACTER_SIZE, Math.max(CHARACTER_SIZE, mainPlayer.x + Math.cos(angle) * dist));
                    const y = Math.min(canvasLogicalH - CHARACTER_SIZE, Math.max(CHARACTER_SIZE, mainPlayer.y + Math.sin(angle) * dist));
                    const trooper = new Character(x, y, backupColor, backupName, backupHp, 'blaster', null, false, false, 'player', false, true, isCommander ? 20 : 25);
                    trooper.characterId     = backupUnitId;
                    trooper.hasCalledBackup = true;
                    trooper.lastShotTime    = Date.now() - Math.random() * 600;
                    entities.push(trooper);
                }

                const label = isCommander
                    ? `${cloneBackupArmy[pCharData.id].name}s moving in, Commander!`
                    : 'Stormtrooper reinforcements inbound!';
                showAnnouncement(label, '#00cfff', 3500, '📡 BACKUP CALLED');
            }

            pauseResumeBtn.addEventListener('click', closePauseMenu);
            pauseBackupBtn.addEventListener('click', () => {
                spawnPauseBackup();
                closePauseMenu();
            });
            pauseQuitBtn.addEventListener('click', () => {
                gamePaused = false;
                pauseOverlay.classList.remove('active');
                cancelAnimationFrame(gameLoopId);
                stopAllSfx();
                canvas.style.display = 'none';
                hud.style.display = 'none';
                document.getElementById('hudTimer').style.display = 'none';
                messageOverlay.style.display = 'none';
                showMainMenu();
                selectedPlayerCharId = null;
                playerWins = 0; enemyWins = 0; isNextRound = false;
                deathParticles = [];
                floatNums = [];
                touchMove.active = false;
                touchMove.x = 0;
                touchMove.y = 0;
                touchFire = false;
                if (touchStickKnob) touchStickKnob.style.transform = 'translate(0,0)';
                resizeCanvas();
                updateMobileControlsVisibility();
            });

            window.addEventListener('keydown', e => {
                keys[e.key] = true;

                // Escape: toggle pause during battle
                if (e.key === 'Escape') {
                    if (gamePaused) {
                        closePauseMenu();
                    } else if (isInBattle()) {
                        openPauseMenu();
                    }
                }

                if ((e.key === '4' && keys['f']) || (e.key.toLowerCase() === 'f' && keys['4'])) {
                    if (opponentMenu.style.display !== 'none' && gameUnlocks.tatooineArena) {
                        specialTatooineJabbaForce = true;
                        showAnnouncement('Jabba test mode enabled. Next Tatooine Leia surprise will summon Carbonite Han.', '#ff6600', 4000, '🛠️ DEV MODE');
                    }
                }
            });
            window.addEventListener('keyup', e => keys[e.key] = false);
            window.addEventListener('resize', resizeCanvas);
            resizeCanvas();
        });