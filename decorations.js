// Te same nazwy i rysunki trafiają do galerii, podglądu oraz eksportu.
export const DECORATION_CHOICES = [
  { id: 'none', title: 'Brak' },
  { id: 'coins', title: 'Monety' },
  { id: 'fishing', title: 'Wędki' },
  { id: 'fish-king', title: 'Król karpi' },
  { id: 'cool-fish', title: 'Ryba w okularach' },
  { id: 'happy-worm', title: 'Wesoły robak' },
  { id: 'old-boot', title: 'Połów: kalosz' },
  { id: 'sleepy-float', title: 'Śpiący spławik' },
  { id: 'fish-trophy', title: 'Puchar wędkarza' },
  { id: 'lucky-hook', title: 'Haczyk na szczęście' },
  { id: 'holiday-frog', title: 'Żaba na urlopie' },
  { id: 'captain-duck', title: 'Kapitan kaczka' },
  { id: 'hope-bucket', title: 'Wiaderko nadziei' },
];

function oval(ctx, x, y, radiusX, radiusY, fill, outline = true) {
  ctx.beginPath();
  ctx.ellipse(x, y, radiusX, radiusY, 0, 0, Math.PI * 2);
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (outline) ctx.stroke();
}

function shape(ctx, points, fill) {
  ctx.beginPath();
  points.forEach(([x, y], index) => (index ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.stroke();
}

function stroke(ctx, points) {
  ctx.beginPath();
  points.forEach(([x, y], index) => (index ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.stroke();
}

function eye(ctx, x, y, color) {
  oval(ctx, x, y, 0.36, 0.42, 'white');
  oval(ctx, x + 0.1, y, 0.13, 0.18, color, false);
}

function smile(ctx, x, y, radius = 0.45) {
  ctx.beginPath();
  ctx.arc(x, y, radius, 0.1, Math.PI - 0.1);
  ctx.stroke();
}

function sunglasses(ctx, x, y, color) {
  oval(ctx, x - 0.55, y, 0.5, 0.38, color);
  oval(ctx, x + 0.55, y, 0.5, 0.38, color);
  stroke(ctx, [
    [x - 1.3, y - 0.2],
    [x + 1.3, y - 0.2],
  ]);
}

function fish(ctx, { color, accent }, glasses = false) {
  shape(
    ctx,
    [
      [-2.5, 0.3],
      [-4.7, -1.1],
      [-4.7, 1.7],
    ],
    accent,
  );
  shape(
    ctx,
    [
      [-1.3, -0.8],
      [-0.5, -1.7],
      [0.6, -0.8],
    ],
    accent,
  );
  oval(ctx, -0.3, 0.3, 3, 1.3, accent);
  if (glasses) sunglasses(ctx, 1.2, -0.05, color);
  else eye(ctx, 1.5, -0.1, color);
  smile(ctx, 1.9, 0.6, 0.42);
  stroke(ctx, [
    [-0.7, 0.1],
    [-1.2, 0.7],
    [-0.5, 0.8],
  ]);
}

function crown(ctx, accent) {
  shape(
    ctx,
    [
      [-1.8, -1],
      [-2.1, -2.2],
      [-1.1, -1.7],
      [-0.5, -2.4],
      [0.1, -1.7],
      [1.1, -2.2],
      [0.8, -1],
    ],
    accent,
  );
}

function worm(ctx, { color, accent }) {
  ctx.beginPath();
  ctx.moveTo(-4.5, 1.7);
  ctx.bezierCurveTo(-3, -0.8, -2.1, 2.7, -0.7, 0.8);
  ctx.bezierCurveTo(0.1, -0.2, 0.4, 2.1, 2.7, 0.1);
  ctx.lineWidth = 1.45;
  ctx.stroke();
  ctx.strokeStyle = accent;
  ctx.lineWidth = 1.05;
  ctx.stroke();
  ctx.strokeStyle = color;
  ctx.lineWidth = 0.2;
  oval(ctx, 3, -0.7, 1.3, 1.4, accent);
  eye(ctx, 2.65, -1.1, color);
  eye(ctx, 3.5, -1.1, color);
  smile(ctx, 3.1, -0.4, 0.55);
}

function boot(ctx, { accent }) {
  ctx.beginPath();
  ctx.moveTo(-3.3, -2.3);
  ctx.bezierCurveTo(-3.4, -0.4, -1.5, -0.6, -1.5, -1.5);
  ctx.stroke();
  shape(
    ctx,
    [
      [-1.7, -1.4],
      [0.7, -1.4],
      [0.7, 0.6],
      [2.9, 0.7],
      [3.7, 1.2],
      [3.7, 2],
      [-1.9, 2],
      [-1.9, 0.7],
    ],
    accent,
  );
  stroke(ctx, [
    [-1.5, -0.9],
    [0.4, -0.9],
  ]);
  stroke(ctx, [
    [-1.8, 1.6],
    [3.6, 1.6],
  ]);
  for (let x = -1.3; x < 3.4; x += 0.7)
    stroke(ctx, [
      [x, 1.7],
      [x, 2.2],
    ]);
}

function sleepyFloat(ctx, { color, accent }) {
  ctx.save();
  ctx.rotate(-0.35);
  stroke(ctx, [
    [0, -2.4],
    [0, 2.4],
  ]);
  oval(ctx, 0, -0.2, 0.85, 1.5, accent);
  oval(ctx, 0, -0.6, 0.65, 0.8, 'white');
  stroke(ctx, [
    [-0.45, -0.5],
    [-0.1, -0.35],
    [0.25, -0.5],
  ]);
  ctx.restore();
  ctx.fillStyle = color;
  ctx.font = '700 1.3px LabelFont';
  ctx.fillText('z', 1.6, -0.3);
  ctx.font = '700 1.7px LabelFont';
  ctx.fillText('Z', 2.8, -1.4);
  stroke(ctx, [
    [-4.2, 1.9],
    [-2.5, 1.7],
    [-1.1, 1.9],
    [0.7, 1.8],
    [2.8, 1.9],
  ]);
}

function trophy(ctx, palette) {
  const { accent } = palette;
  oval(ctx, -2.5, -0.8, 1.05, 1.05, null);
  oval(ctx, 2.5, -0.8, 1.05, 1.05, null);
  shape(
    ctx,
    [
      [-2.5, -2.2],
      [2.5, -2.2],
      [2.1, 0.2],
      [0.6, 1.1],
      [0.6, 1.6],
      [2, 1.8],
      [2, 2.3],
      [-2, 2.3],
      [-2, 1.8],
      [-0.6, 1.6],
      [-0.6, 1.1],
      [-2.1, 0.2],
    ],
    accent,
  );
  ctx.save();
  ctx.translate(0.3, -1.15);
  ctx.scale(0.5, 0.5);
  fish(ctx, { ...palette, accent: 'white' });
  ctx.restore();
}

function luckyHook(ctx, { color, accent }) {
  oval(ctx, -0.7, -1.9, 0.4, 0.4, null);
  ctx.beginPath();
  ctx.moveTo(-0.7, -1.5);
  ctx.lineTo(-0.7, 0.8);
  ctx.bezierCurveTo(-0.7, 2.8, -3.5, 2.8, -3.5, 0.4);
  ctx.lineTo(-2.8, 1);
  ctx.lineWidth = 0.35;
  ctx.stroke();
  ctx.lineWidth = 0.2;
  for (const [x, y] of [
    [1.5, -1.5],
    [2.7, -1.5],
    [1.5, -0.3],
    [2.7, -0.3],
  ])
    oval(ctx, x, y, 0.8, 0.8, accent);
  stroke(ctx, [
    [2.1, -0.9],
    [2.2, 1.5],
    [3, 2],
  ]);
  oval(ctx, 2.1, -0.9, 0.2, 0.2, color, false);
}

function frog(ctx, { color, accent }) {
  oval(ctx, -3, 1.8, 1.25, 0.45, accent);
  oval(ctx, 3, 1.8, 1.25, 0.45, accent);
  oval(ctx, 0, 0.3, 2.8, 1.7, accent);
  oval(ctx, -1.75, -1.2, 0.95, 1, accent);
  oval(ctx, 1.75, -1.2, 0.95, 1, accent);
  sunglasses(ctx, -1.2, -1.1, color);
  sunglasses(ctx, 1.2, -1.1, color);
  smile(ctx, 0, 0.3, 1.25);
}

function duck(ctx, { color, accent }) {
  shape(
    ctx,
    [
      [-2, 0.7],
      [-4, -0.1],
      [-3.2, 1.2],
    ],
    accent,
  );
  oval(ctx, -0.5, 0.9, 2.9, 1.15, accent);
  oval(ctx, 1.9, -0.5, 1.2, 1.3, accent);
  shape(
    ctx,
    [
      [2.8, -0.7],
      [4.5, -0.3],
      [2.8, 0.1],
    ],
    accent,
  );
  eye(ctx, 2.2, -0.75, color);
  shape(
    ctx,
    [
      [0.6, -1.5],
      [0.9, -2.3],
      [3, -2.3],
      [3.2, -1.5],
    ],
    'white',
  );
  stroke(ctx, [
    [0.5, -1.5],
    [3.3, -1.5],
  ]);
  oval(ctx, -0.7, 0.9, 1.1, 0.5, null);
  stroke(ctx, [
    [-4.7, 2.2],
    [-2.6, 2],
    [-0.5, 2.2],
    [1.5, 2],
    [4.4, 2.2],
  ]);
}

function bucket(ctx, palette) {
  const { accent } = palette;
  ctx.beginPath();
  ctx.arc(0, -0.4, 2.2, Math.PI, 0);
  ctx.stroke();
  shape(
    ctx,
    [
      [-2.8, -0.8],
      [2.8, -0.8],
      [2.1, 2.1],
      [-2.1, 2.1],
    ],
    accent,
  );
  oval(ctx, 0, -0.8, 2.8, 0.55, 'white');
  ctx.save();
  ctx.translate(0.3, -1.5);
  ctx.scale(0.42, 0.42);
  fish(ctx, palette);
  ctx.restore();
  smile(ctx, 0, 0.3, 0.85);
}

// Współrzędne mieszczą się w prostokącie 10,6 × 5 jednostek,
// którego używa również walidacja rozmiaru ozdoby w rendererze.
export function drawPlayfulDecoration(ctx, kind, palette) {
  ctx.save();
  ctx.strokeStyle = palette.color;
  ctx.lineWidth = 0.2;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.scale(0.92, 0.92);
  switch (kind) {
    case 'fish-king':
      fish(ctx, palette);
      crown(ctx, palette.accent);
      break;
    case 'cool-fish':
      fish(ctx, palette, true);
      break;
    case 'happy-worm':
      worm(ctx, palette);
      break;
    case 'old-boot':
      boot(ctx, palette);
      break;
    case 'sleepy-float':
      sleepyFloat(ctx, palette);
      break;
    case 'fish-trophy':
      trophy(ctx, palette);
      break;
    case 'lucky-hook':
      luckyHook(ctx, palette);
      break;
    case 'holiday-frog':
      frog(ctx, palette);
      break;
    case 'captain-duck':
      duck(ctx, palette);
      break;
    case 'hope-bucket':
      bucket(ctx, palette);
      break;
  }
  ctx.restore();
}
