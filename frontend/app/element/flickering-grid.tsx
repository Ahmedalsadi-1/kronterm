// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { cn } from "@/util/util";
import * as React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

interface FlickeringGridProps extends React.HTMLAttributes<HTMLDivElement> {
    squareSize?: number;
    gridGap?: number;
    flickerChance?: number;
    color?: string;
    width?: number;
    height?: number;
    maxOpacity?: number;
}

const FlickeringGrid = React.memo(
    ({
        squareSize = 4,
        gridGap = 6,
        flickerChance = 0.3,
        color = "rgb(0, 0, 0)",
        width,
        height,
        maxOpacity = 0.3,
        className,
        ...props
    }: FlickeringGridProps) => {
        const canvasRef = useRef<HTMLCanvasElement>(null);
        const containerRef = useRef<HTMLDivElement>(null);
        const [isInView, setIsInView] = useState(false);
        const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });

        const memoizedColor = useMemo(() => {
            const canvas = document.createElement("canvas");
            canvas.width = canvas.height = 1;
            const ctx = canvas.getContext("2d");
            if (!ctx) return "rgba(255, 0, 0,";
            ctx.fillStyle = color;
            ctx.fillRect(0, 0, 1, 1);
            const data = ctx.getImageData(0, 0, 1, 1).data;
            return `rgba(${data[0]}, ${data[1]}, ${data[2]}, `;
        }, [color]);

        const setupCanvas = useCallback(
            (canvas: HTMLCanvasElement, w: number, h: number) => {
                const dpr = window.devicePixelRatio || 1;
                canvas.width = w * dpr;
                canvas.height = h * dpr;
                canvas.style.width = `${w}px`;
                canvas.style.height = `${h}px`;

                const cols = Math.floor(w / (squareSize + gridGap));
                const rows = Math.floor(h / (squareSize + gridGap));
                const squares = new Float32Array(cols * rows);
                for (let i = 0; i < squares.length; i++) {
                    squares[i] = Math.random() * maxOpacity;
                }
                return { cols, rows, squares, dpr };
            },
            [squareSize, gridGap, maxOpacity]
        );

        const updateSquares = useCallback(
            (squares: Float32Array, deltaTime: number) => {
                for (let i = 0; i < squares.length; i++) {
                    if (Math.random() < flickerChance * deltaTime) {
                        squares[i] = Math.random() * maxOpacity;
                    }
                }
            },
            [flickerChance, maxOpacity]
        );

        const drawGrid = useCallback(
            (
                ctx: CanvasRenderingContext2D,
                w: number,
                h: number,
                cols: number,
                rows: number,
                squares: Float32Array,
                dpr: number
            ) => {
                ctx.clearRect(0, 0, w, h);
                for (let i = 0; i < cols; i++) {
                    for (let j = 0; j < rows; j++) {
                        const opacity = squares[i * rows + j];
                        ctx.fillStyle = `${memoizedColor}${opacity})`;
                        ctx.fillRect(
                            i * (squareSize + gridGap) * dpr,
                            j * (squareSize + gridGap) * dpr,
                            squareSize * dpr,
                            squareSize * dpr
                        );
                    }
                }
            },
            [memoizedColor, squareSize, gridGap]
        );

        useEffect(() => {
            const canvas = canvasRef.current;
            const container = containerRef.current;
            if (!canvas || !container) return;

            const ctx = canvas.getContext("2d");
            if (!ctx) return;

            let animationFrameId: number;
            let gridParams: ReturnType<typeof setupCanvas>;

            const updateCanvasSize = () => {
                const newWidth = width || container.clientWidth;
                const newHeight = height || container.clientHeight;
                setCanvasSize({ width: newWidth, height: newHeight });
                gridParams = setupCanvas(canvas, newWidth, newHeight);
            };

            updateCanvasSize();

            let lastTime = 0;
            const animate = (time: number) => {
                if (!lastTime) lastTime = time;
                const deltaTime = (time - lastTime) / 1000;
                lastTime = time;

                updateSquares(gridParams.squares, deltaTime);
                drawGrid(ctx, canvas.width, canvas.height, gridParams.cols, gridParams.rows, gridParams.squares, gridParams.dpr);
                animationFrameId = requestAnimationFrame(animate);
            };

            const resizeObserver = new ResizeObserver(() => {
                updateCanvasSize();
            });
            resizeObserver.observe(container);

            const intersectionObserver = new IntersectionObserver(([entry]) => setIsInView(entry.isIntersecting));
            intersectionObserver.observe(canvas);

            if (isInView) {
                animationFrameId = requestAnimationFrame(animate);
            }

            return () => {
                if (animationFrameId) cancelAnimationFrame(animationFrameId);
                resizeObserver.disconnect();
                intersectionObserver.disconnect();
            };
        }, [setupCanvas, updateSquares, drawGrid, width, height, isInView]);

        return (
            <div
                ref={containerRef}
                className={cn("absolute inset-0 pointer-events-none", className)}
                aria-hidden="true"
                {...props}
            >
                <canvas ref={canvasRef} />
            </div>
        );
    }
);

FlickeringGrid.displayName = "FlickeringGrid";

export { FlickeringGrid };
export type { FlickeringGridProps };
