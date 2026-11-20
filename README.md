# GameNotation

**A graphical notation for tension in games.** It writes down play the way music is written down: a **score** of a game as it is played, with progress as the melody, tension as the dynamics, and recurring patterns as voices.

It has two parts:

- **Tension Score** (`tension-score.html`): two small games that measure themselves while they run, scored with the same notation. A switch at the top picks the game. You can watch a bot or play yourself, and rate your own tension to see which measure tracks you best.
  - **Arena**: a dodging game. Collect sparks, reach the gate, and avoid enemies that arrive in four motifs.
  - **Zedrix**: an original falling-block game with its own five pieces (Duo, Bar, Hook, Zed, Cross), a 9 x 18 well, and a row with one gap that rises from the bottom every 10 pieces. The pieces are the motifs, and the rising rows give the game a regular meter.
- **Tension Score Analysis** (`tension-score-analysis.html`): what seeded bot sessions of the arena game show when you look at them all at once. Zedrix is not in the analysis yet.

Both are single HTML files. The only outside files are Google Fonts and, on the game page, [anime.js](https://animejs.com/) 3.2.2 from cdnjs for panel motion; without it (offline, or with reduced motion turned on) panels simply open and close instantly.

The game page is laid out as three screens, each one window tall: the game with its live readout, then the score and session, then the definitions and references. On a desktop-sized window the game shrinks or grows to fill the first screen exactly.

## Open it

The `docs/` folder holds the website version: `docs/index.html` is the games and `docs/analysis.html` the analysis. GitHub Pages serves it from there, and you can also open either file directly.

To rebuild the website and the local copies after changing a page:

```
node tools/build-local.js
```

This writes `docs/` (committed, for GitHub Pages) and `local/` (ignored, for double-clicking). The files at the repository root leave out `<!doctype>`, `<head>` and `<body>`, because they are published as artifacts that add those. Both pages are kept as plain ASCII so they display correctly however they are opened; `node tools/ascii-safe.js <file>` escapes any special characters.

## What the game measures

Each moment of play is scored on:

| Measure | What it is |
|---|---|
| **Progress** | Zone number plus sparks collected: the melody line. |
| **Stakes** | Progress you would lose by dying now, plus a small fixed cost. A sawtooth with checkpoints, a climb with permadeath. |
| **Threat** | Missing hearts plus how close the enemies are. |
| **Uncertainty** | The game copies its state about three times a second and plays 24 possible next-3-seconds forward. Uncertainty is the binary entropy of how many of those futures get hit. |
| **Tension** | `(stakes x threat x uncertainty)^(1/3)`, shown as a dynamic marking from *pp* to *ff*. |
| **Pattern surprise** | A model that learns the sequence of enemy motifs as you play scores how unexpected each one is (`-log2 P(motif | recent motifs)`). |

Enemies arrive as four **motifs**: A Pincer, B Crossfire, C Stream and D Ring. With structured composition they follow phrase forms that grow as motifs are unlocked (AAAA, AABA, ABAC, ABACABAD), with cadences that layer two motifs and occasional broken patterns. A random composition is available for comparison.

For comparison, the game also computes Ely-style suspense and surprise, a Left 4 Dead-style intensity, and the number of motifs playing at once.

In **Zedrix** the same measures apply with game-specific inputs:

| Measure | In Zedrix |
|---|---|
| **Progress** | Level plus rows cleared out of 8. |
| **Threat** | Stack height, covered holes and unevenness. |
| **Uncertainty** | 24 simulated futures of the next 8 pieces (the two shown, then pieces from the same randomizer), placed by the bot's heuristic. A future fails if the stack enters the danger zone (the top 3 rows). |
| **Motifs** | The pieces. Structured order deals them in shuffled sets of five, so the order is partly learnable, and a set occasionally breaks. Random order draws each piece independently. |
| **Concurrency** | Open wells: columns at least 3 lower than both neighbours. |

The bot places pieces with a standard height, lines, holes and unevenness heuristic (after Yiyuan Lee's weights) and moves each piece one step at a time.

The game code is organised so the shared parts (measures, score, rating, sound) are the same for both games. Each game supplies an adapter with its state, moves, bot, simulated futures, drawing and rules text.

## Rating mode

Press **Rate my tension** and nudge your felt tension up or down while you watch or play: the mouse wheel over the arena, `E`/`Q`, the slider, or the arrow keys while watching. After a minute, the page ranks how well each measure tracks you, allowing for reaction time, and shows how your tension changes across a motif's 1st, 2nd and later appearances. **Copy results** copies the session as text.

## Reproduce the analysis

```
node tools/arena-analysis.js 600
node tools/build-analysis.js
```

`arena-analysis.js` runs the game's own code headlessly: six seeded 10-minute bot sessions (three with checkpoints, three with permadeath) plus three random-composition sessions for comparison. It writes `data/arena-analysis.json`. `build-analysis.js` inlines that data into `analysis/template.html` to produce `tension-score-analysis.html`.

## Findings so far (bot play)

- Our tension formula behaves almost exactly like Ely, Frankel and Kamenica's (2015) suspense (r = 0.87 to 0.97). The framework rediscovers it.
- Left 4 Dead-style intensity is a different, reactive signal: it rises about 2 seconds after our tension, because it responds to damage, not danger.
- The death rule mostly changes stakes. Permadeath produces long quiet stretches and rare, very loud moments.
- Tension rises with the number of motifs playing at once and levels off at three to four.
- Structured composition is learnable (1.4 bits of uncertainty per motif against 1.8 for random order), and broken patterns register as 5 to 6 bits of surprise.
- No repeating tension cycle (meter) has been found yet.

These come from bot play. Whether any of the measures matches what a person feels is the open question the rating mode is for.

## Project files

```
tension-score.html            both games (artifact source)
tension-score-analysis.html   the analysis page (generated)
analysis/template.html        analysis page source; data is inlined at build time
data/arena-analysis.json      output of the headless sessions
tools/arena-analysis.js       runs seeded headless sessions and computes the analysis
tools/build-analysis.js       builds the analysis page
tools/build-local.js          writes the website (docs/) and standalone copies (local/)
tools/ascii-safe.js           escapes special characters so pages display correctly anywhere
docs/                         the GitHub Pages site (generated)
```

## Design rule

Every game rule is stated on screen (the Rules panel) or taught through play (a first-time explanation in the event log beside the game, plus visual and audio feedback). There are no hidden mechanics.

## References

The analysis page ends with the full reference list (44 works) and what each was used for. The central ones are Ely, Frankel and Kamenica (2015) on suspense and surprise; Meyer (1956) and Huron (2006) on musical expectation; Lerdahl (2001) on tonal tension; Booth (2009) on Left 4 Dead's AI Director; and Koster (2004) on fun as learning.
