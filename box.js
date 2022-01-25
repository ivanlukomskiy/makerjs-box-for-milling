// Страница для генерации чертежа:
// https://maker.js.org/playground/

var makerjs = require('makerjs');

// Линейные размеры макета
const designLenX = 750;  // Длина
const designLenY = 450;  // Ширина
const designLenZ = 300;  // Высота

const toothLength = 100;  // Длина зуба для дна коробки
const sheetThickness = 14;  // Толщина листа

// Длина ножек коробки
const legsLength = sheetThickness;

// Отступ отверстий под зубья дна коробки от нижнего края стенки
const toothHolesElevation = 2 * sheetThickness;

// Линейные размеры коробки
const lenX = designLenX + 40;
const lenY = designLenY + 40;
const lenZ = designLenZ + legsLength + toothHolesElevation + 2 * sheetThickness + 40;

// Ширина ножек коробки
const legsWidth = Math.max(50, Math.max(lenX, lenY) / 10);

// Допуски, положительный - более тугая посадка, отрицательный - более свободная
const toleranceConfig = {
    length: 0, // Допуск по длине зубца (влияет на ширину зубцов относительно пазов под них)
    width: 0, // Допуск по толщине зубца (влияет на ширину отверстия под зубец в стенке коробки)
    lidTolerance: -3, // Допуск для крышки
};

// Примерная высота зубца на стыке вертикальных стенок
const zSegmentDesiredHeight = 100;
// Число зубцов на стыке вертикальных стенок
const zSegmentsCount = Math.max(3, Math.round(lenZ / zSegmentDesiredHeight));

// Примерная длина на один зуб для дна коробки
const desiredLengthPerHorizontalTooth = 500;
// Число зубцов для дна коробки по двум сторонам
const xToothCount = Math.max(1, Math.round(lenX / desiredLengthPerHorizontalTooth));
const yToothCount = Math.max(1, Math.round(lenY / desiredLengthPerHorizontalTooth));

// Радиус скруглений внутренних углов
const roundings = 3;

// Число ручек
const handlesCount = lenY > 750 ? 2 : 1;
// Ширина и радиус скругления ручки
const totalHandleWidth = 175;
const handlesRadius = 20;
// Отступ ручки от верха коробки
const handlesDescent = 4 * sheetThickness;

// Диаметр вентиляционного отверстия и его отступ от края коробки
const ventHoleDiameter = 40;
const ventHoleOffset = 50;

// Влияет насколько далеко чертежи стенок расположены друг от друга
const drawingsSpacingCoefficient = 1.5;

// Размеры паза под крышку коробки
const lidToothOffset = 0.2 * Math.min(lenX, lenY);
const lidToothLenX = lenX - 2 * lidToothOffset;
const lidToothLenY = lenY - 2 * lidToothOffset;

// Длина и ширина отверстий под зубья дна коробки
const toothHolesLength = toothLength;
const toothHolesWidth = sheetThickness;

// Длина зубцов
const toothDepth = sheetThickness;

// Ширина ручки без учёта скруглений
const handlesWidth = totalHandleWidth - 2 * handlesRadius;

const Align = Object.freeze({'center': 1, 'right': 2})

function drawToothedLineSegment(x, toothLength, isConvex, toothDepth) {
    if (isConvex) {
        return [
            new makerjs.paths.Line([x, toothDepth], [x + toothLength, toothDepth]),
            new makerjs.paths.Line([x + toothLength, 0], [x + toothLength, toothDepth]),
            new makerjs.paths.Line([x, 0], [x, toothDepth])
        ]
    } else {
        return [new makerjs.paths.Line([x, 0], [x + toothLength, 0])]
    }
}

function drawToothedLine(lineConfig) {
    const {
        len, toothCount = 1, toothLength, toothSpacing = 0, toothDepth, isMother = false,
        align = Align.center, tolerance
    } = lineConfig;

    let totalOffset = len - toothCount * toothLength - (toothCount - 1) * toothSpacing;
    if (Math.abs(totalOffset) < 0.00000001) {
        totalOffset = 0;
    }
    if (totalOffset < 0) {
        throw "Negative offset of wall, " + JSON.stringify(lineConfig, null, 2) + ", " + totalOffset;
    }
    let offsetLeft = 0, offsetRight = 0;

    switch (align) {
        case Align.center:
            offsetLeft = totalOffset / 2;
            offsetRight = totalOffset / 2;
            break;
        case Align.right:
            offsetLeft = totalOffset;
            offsetRight = 0;
            break
        default:
            throw 'Invalid align ' + align;
    }

    const segments = [];
    if (offsetLeft !== 0) {
        segments.push({len: offsetLeft, convex: isMother})
    }
    for (let i = 0; i < toothCount; i++) {
        segments.push({len: toothLength, convex: !isMother});
        if (i < toothCount - 1) {
            segments.push({len: toothSpacing, convex: isMother});
        }
    }
    if (offsetRight !== 0) {
        segments.push({len: offsetRight, convex: isMother});
    }

    // Apply tolerance
    for (let i = 0; i < segments.length; i++) {
        const segment = segments[i]
        const toleranceMultiplier = i === 0 || i === segments.length - 1 ? 0.5 : 1;
        const toleranceSign = segment['convex'] ? 1 : -1;
        segment['len'] = segment['len'] + tolerance * toleranceMultiplier * toleranceSign;
    }

    let paths = {};
    let x = 0;
    // Draw segments
    for (const segment of segments) {
        const lines = drawToothedLineSegment(x, segment['len'], segment['convex'], toothDepth);
        for (const line of lines) {
            paths[Math.random().toString()] = line;
        }
        x += segment['len']
    }
    return {paths};
}

function addUndercuts(models) {
    const chains = makerjs.model.findChains({models});
    for (let i = 0; i < chains.length; i++) {
        const chain = chains[i];
        models['undercut' + i] = makerjs.chain.dogbone(chain, {left: roundings});
    }
}

function addHandles(models, sideConfig, handles) {
    const {count, descent, width, radius} = handles
    const spacing = (sideConfig['width'] - count * width - count * radius * 2) / count;
    const y = sideConfig['height'] - descent - radius * 2 - toothDepth
    for (let i = 0; i < count; i++) {
        const x = spacing * (i + 0.5) + (width + radius * 2) * i;
        const handle = new makerjs.models.Oval(width + radius * 2, radius * 2)
        makerjs.model.move(handle, [x, y]);
        models['handle' + i] = handle;
    }
}

function getToothHolePositions(len, holesCount) {
    const spacing = (len - holesCount * toothHolesLength) / holesCount;
    const positions = [];
    for (let i = 0; i < holesCount; i++) {
        const x = (spacing + toothHolesLength) * (i + 0.5);
        positions.push(x)
    }
    return positions;
}

function addToothHoles(models, sideConfig) {
    const { toothHolesCount, width } = sideConfig;
    const positions = getToothHolePositions(width, toothHolesCount)
    const toothHoles = {}
    const realHoleLength = toothHolesLength - toleranceConfig.length;
    for (let position of positions) {
        const hole = new makerjs.models.Rectangle(realHoleLength, toothHolesWidth - toleranceConfig.width)
        makerjs.model.move(hole,
            [position - realHoleLength / 2, toothHolesElevation + legsLength + toleranceConfig.width / 2]);
        toothHoles['toothHole' + position] = hole;
    }
    addUndercuts(toothHoles);
    models['toothHoles'] = {models: toothHoles};
}

function drawSide(sideConfig) {
    const {
        width, height, lidToothLength, isMother, handles = null
    } = sideConfig
    const zToothCount = Math.ceil(zSegmentsCount / 2)
    const leftWall = drawToothedLine({
        len: height,
        toothCount: zToothCount,
        toothLength: height / zSegmentsCount,
        toothSpacing: height / zSegmentsCount,
        toothDepth,
        isMother,
        align: Align.right,
        tolerance: toleranceConfig.length,
    });
    makerjs.model.rotate(leftWall, 90, [0, 0]);
    const rightWall = makerjs.model.mirror(leftWall, true, false);
    makerjs.model.move(rightWall, [width, 0]);
    const bottom = drawToothedLine({
        len: width,
        toothLength: width - legsWidth * 2,
        toothDepth: legsLength,
        tolerance: 0, // no tolerance needed - its not a joint
    })
    let top = drawToothedLine({
        len: width,
        toothLength: lidToothLength,
        toothDepth,
        tolerance: -toleranceConfig.length, // negative tolerance - its receiving part
    })
    top = makerjs.model.mirror(top, false, true);
    const models = {
        leftWall,
        rightWall,
        bottom,
        top,
    }
    makerjs.model.move(top, [0, height]);
    addUndercuts(models);
    if (handles !== null) {
        addHandles(models, sideConfig, handles)
    }
    addToothHoles(models, sideConfig);
    return {models};
}

function drawBottom() {
    const spacingY = (lenY - toothLength * yToothCount) / yToothCount;
    const leftWall = drawToothedLine({
        len: lenY,
        toothCount: yToothCount,
        toothLength: toothLength,
        toothSpacing: spacingY,
        toothDepth,
        tolerance: toleranceConfig.length
    });
    makerjs.model.rotate(leftWall, 90, [0, 0]);
    const rightWall = makerjs.model.mirror(leftWall, true, false);
    makerjs.model.move(rightWall, [lenX, 0]);

    const spacingX = (lenX - toothLength * xToothCount) / xToothCount;
    const bottomWall = drawToothedLine({
        len: lenX,
        toothCount: xToothCount,
        toothLength: toothLength,
        toothSpacing: spacingX,
        toothDepth,
        tolerance: toleranceConfig.length,
    });
    const topWall = makerjs.model.mirror(bottomWall, false, true);
    makerjs.model.move(bottomWall, [0, lenY]);

    const models = {leftWall, rightWall, bottomWall, topWall};
    addUndercuts(models);
    return {models}
}

function drawTop() {
    const realLenY = lenY + toleranceConfig.lidTolerance;
    const realLenX = lenX + toleranceConfig.lidTolerance;

    const leftWall = drawToothedLine({
        len: realLenY,
        toothLength: lidToothLenY,
        toothDepth: toothDepth - toleranceConfig.lidTolerance / 2,
        tolerance: toleranceConfig.length + toleranceConfig.lidTolerance
    });
    makerjs.model.rotate(leftWall, 90, [0, 0]);
    const rightWall = makerjs.model.mirror(leftWall, true, false);
    makerjs.model.move(rightWall, [realLenX, 0]);

    const bottomWall = drawToothedLine({
        len: realLenX,
        toothLength: lidToothLenX,
        toothDepth: toothDepth - toleranceConfig.lidTolerance / 2,
        tolerance: toleranceConfig.length + toleranceConfig.lidTolerance
    });
    const topWall = makerjs.model.mirror(bottomWall, false, true);
    makerjs.model.move(bottomWall, [0, realLenY]);

    const models = {leftWall, rightWall, bottomWall, topWall};
    addUndercuts(models);

    // add vent holes
    const vh1 = new makerjs.paths.Circle([ventHoleOffset - toothDepth, realLenY / 2],
        ventHoleDiameter / 2);
    const vh2 = new makerjs.paths.Circle([realLenX - ventHoleOffset + toothDepth, realLenY / 2],
        ventHoleDiameter / 2);
    models['ventHoles'] = {paths: {vh1, vh2}}

    return {models}
}

function render() {
    const sideX = drawSide({
        width: lenX,
        height: lenZ,
        toothHolesCount: xToothCount,
        lidToothLength: lidToothLenX,
        isMother: true
    });
    const sideX2 = makerjs.cloneObject(sideX, [lenX * drawingsSpacingCoefficient, 0]);
    makerjs.model.move(sideX2, [0, lenZ * drawingsSpacingCoefficient]);

    const sideY = drawSide({
        width: lenY,
        height: lenZ,
        toothHolesCount: yToothCount,
        lidToothLength: lidToothLenY,
        isMother: false,
        handles: {
            count: handlesCount,
            descent: handlesDescent,
            width: handlesWidth,
            radius: handlesRadius,
        }
    });
    makerjs.model.move(sideY, [lenX * drawingsSpacingCoefficient, 0]);
    const sideY2 = makerjs.cloneObject(sideY, [lenX * drawingsSpacingCoefficient, 0]);
    makerjs.model.move(sideY2, [lenX * drawingsSpacingCoefficient, lenZ * drawingsSpacingCoefficient]);

    const bottom = drawBottom();
    makerjs.model.move(bottom, [0, lenZ * 2 * drawingsSpacingCoefficient]);

    const top = drawTop();
    makerjs.model.move(top, [lenX * drawingsSpacingCoefficient, lenZ * 2 * drawingsSpacingCoefficient]);

    this.models = {
        sideX, sideY, sideX2, sideY2, bottom, top
    };
}

module.exports = render;
