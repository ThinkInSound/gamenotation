# GameNotation

An experiment in writing down play the way music is written down: a **score** of a game as it is played, with progress as the melody, tension as the dynamics, and recurring encounter patterns as voices.

It has two parts:

- **Tension Score** (`tension-score.html`): a small arena game that measures itself while it runs. You can watch a bot or play yourself, and rate your own tension to see which measure tracks you best.
- **Tension Score Analysis** (`tension-score-analysis.html`): what seeded bot sessions of that game show when you look at them all at once.

Both are single HTML files with no dependencies beyond Google Fonts.

## Open it

Build standalone copies and open them by double-clicking:

```
node tools/build-local.js
```

This writes `local/tension-score.html` and `local/tension-score-analysis.html`. (The files at the repository root leave out `<!doctype>`, `<head>` and `<body>`, because they are published as artifacts that add those.)

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
tension-score.html            the game (artifact source)
tension-score-analysis.html   the analysis page (generated)
analysis/template.html        analysis page source; data is inlined at build time
data/arena-analysis.json      output of the headless sessions
tools/arena-analysis.js       runs seeded headless sessions and computes the analysis
tools/build-analysis.js       builds the analysis page
tools/build-local.js          writes standalone copies to local/
```

## Design rule

Every game rule is stated on screen (the Rules panel) or taught through play (first-time captions, visual and audio feedback). There are no hidden mechanics.

## References

The analysis page ends with the full reference list (44 works) and what each was used for. The central ones are Ely, Frankel and Kamenica (2015) on suspense and surprise; Meyer (1956) and Huron (2006) on musical expectation; Lerdahl (2001) on tonal tension; Booth (2009) on Left 4 Dead's AI Director; and Koster (2004) on fun as learning.
