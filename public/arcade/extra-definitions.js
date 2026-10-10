export const extraGameDefinitions = {
  stack: {
    name: 'Prism Stack',
    category: 'Arcade',
    description: 'Seven shapes. One little gap. Make it count.',
    rules: 'Fit each falling shape into the field and clear complete rows. Arrow keys or A/D move; Down or S soft-drops; Up rotates; Space hard-drops. On touch screens, hold the direction buttons and use Rotate or Drop. Every ten cleared rows raises the level and speeds up the fall.',
  },
  typerush: {
    name: 'Word Rush',
    category: 'Word',
    description: 'Forty-five seconds. Find your rhythm.',
    scoreLabel: 'Words / min',
    bestLabel: 'Best pace',
    format: value => Number(value).toFixed(1),
    bestFormat: value => Number(value).toFixed(1),
    rules: 'Start the clock, then type each line as accurately as you can. Correct letters glow teal and mistakes turn rose. A completed line advances automatically. Your score is net words per minute; the live readout also shows accuracy. The timer pauses with the game.',
  },
};

