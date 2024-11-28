import { useEffect, useRef, useState } from "react";
import { SWATCHES } from "@/constants";
import { ColorSwatch, Group } from "@mantine/core";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import axios from "axios";
import Draggable from "react-draggable";

interface Response {
    expr: string;
    result: string;
    assign: boolean;
}

interface GeneratedResult {
    expression: string;
    answer: string;
}

export default function Home() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [color, setColor] = useState("rgb(255, 255, 255)");
    const [reset, setReset] = useState(false);
    const [result, setResult] = useState<GeneratedResult>();
    const [dictOfVars, setDictOfVars] = useState({});
    const [latexPosition, setLatexPosition] = useState({ x: 10, y: 200 });
    const [latexExpression, setLatexExpression] = useState<Array<string>>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (reset) {
            resetCanvas();
            setLatexExpression([]);
            setResult(undefined);
            setDictOfVars({});
            setReset(false);
        }
    }, [reset]);

    useEffect(() => {
        if (latexExpression.length > 0 && window.MathJax) {
            setTimeout(() => {
                window.MathJax.Hub.Queue(["Typeset", window.MathJax.Hub]);
            }, 0);
        }
    }, [latexExpression]);

    useEffect(() => {
        if (result) {
            renderLatexToCanvas(result.expression, result.answer);
        }
    }, [result]);

    useEffect(() => {
        const canvas = canvasRef.current;

        if (canvas) {
            const ctx = canvas.getContext("2d");
            if (ctx) {
                canvas.width = window.innerWidth;
                canvas.height = window.innerHeight - canvas.offsetTop;
                ctx.lineCap = "round";
                ctx.lineWidth = 3;
            }
        }

        const script = document.createElement("script");
        script.src =
            "https://cdnjs.cloudflare.com/ajax/libs/mathjax/2.7.9/MathJax.js?config=TeX-MML-AM_CHTML";
        script.async = true;
        document.head.appendChild(script);

        script.onload = () => {
            window.MathJax.Hub.Config({
                tex2jax: {
                    inlineMath: [
                        ["$", "$"],
                        ["\\(", "\\)"],
                    ],
                },
            });
        };

        return () => {
            document.head.removeChild(script);
        };
    }, []);

    const renderLatexToCanvas = (expression: string, answer: string) => {
        const latex = `\\(\\LARGE{${expression} = ${answer}}\\)`;
        setLatexExpression([...latexExpression, latex]);

        // Clear the main canvas
        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext("2d");
            if (ctx) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
            }
        }
    };

    const sendData = async () => {
        const canvas = canvasRef.current;

        if (canvas) {
            setLoading(true);
            console.log(import.meta.env.VITE_API_URL);
            const response = await axios({
                method: "post",
                url: `${import.meta.env.VITE_API_URL}/calculate/`,
                data: {
                    image: canvas.toDataURL("image/png"),
                    dict_of_vars: dictOfVars,
                },
            });

            const resp = await response.data;
            resp.data.forEach((data: Response) => {
                if (data.assign === true) {
                    setDictOfVars({
                        ...dictOfVars,
                        [data.expr]: data.result,
                    });
                }
            });

            setLoading(false);

            const ctx = canvas.getContext("2d");
            const imageData = ctx!.getImageData(
                0,
                0,
                canvas.width,
                canvas.height
            );
            let minX = canvas.width,
                minY = canvas.height,
                maxX = 0,
                maxY = 0;

            for (let y = 0; y < canvas.height; y++) {
                for (let x = 0; x < canvas.width; x++) {
                    const i = (y * canvas.width + x) * 4;
                    if (imageData.data[i + 3] > 0) {
                        // If pixel is not transparent
                        minX = Math.min(minX, x);
                        minY = Math.min(minY, y);
                        maxX = Math.max(maxX, x);
                        maxY = Math.max(maxY, y);
                    }
                }
            }

            const centerX = (minX + maxX) / 2;
            const centerY = (minY + maxY) / 2;

            setLatexPosition({ x: centerX, y: centerY });
            resp.data.forEach((data: Response) => {
                setTimeout(() => {
                    setResult({
                        expression: data.expr,
                        answer: data.result,
                    });
                }, 200);
            });
        }
    };

    const resetCanvas = () => {
        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext("2d");

            if (ctx) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
            }
        }
    };

    const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (canvas) {
            canvas.style.background = "black";
            const ctx = canvas.getContext("2d");

            if (ctx) {
                ctx.beginPath();
                ctx.moveTo(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
                setIsDrawing(true);
            }
        }
    };

    const stopDrawing = () => {
        setIsDrawing(false);
    };

    const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!isDrawing) {
            return;
        }

        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext("2d");

            if (ctx) {
                ctx.strokeStyle = color;
                ctx.lineTo(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
                ctx.stroke();
            }
        }
    };

    return (
        <>
            {/* Reset and Calculate Buttons - Positioned on Top Right */}
            <div className="absolute top-0 right-0 flex gap-3 m-5">
                {/* Reset Button */}
                <Button
                    onClick={() => setReset(true)}
                    className="z-20 bg-red-800 text-white text-xl w-40 p-6 border rounded-lg"
                    variant="default"
                    color="black"
                >
                    Clear
                </Button>

                {/* Calculate Button */}
                <Button
                    onClick={sendData}
                    className="z-20 bg-green-800 text-white text-xl w-40 p-6 border rounded-lg"
                    variant="default"
                    color="black"
                >
                    {loading ? (
                        <Spinner size="large" className="text-white" />
                    ) : (
                        "Calculate"
                    )}
                </Button>
            </div>

            {/* Container for Logo and Color Swatches */}
            <div className="z-20 absolute left-0 m-5 flex flex-col gap-4">
                {/* Logo Image */}
                <img src="/logo.png" alt="Logo" className="w-40 h-auto mb-4" />

                {/* Color Swatches Group */}
                <Group className="bg-gray-700 p-2 border rounded-lg flex-col gap-4 w-14">
                    {SWATCHES.map((swatchColor: string) => (
                        <ColorSwatch
                            key={swatchColor}
                            color={swatchColor}
                            onClick={() => setColor(swatchColor)}
                            className="w-8 h-8" // Adjust size of swatches if needed
                        />
                    ))}
                </Group>
            </div>

            <canvas
                ref={canvasRef}
                id="canvas"
                className="absolute top-0 left-0 w-full h-full bg-black"
                onMouseDown={startDrawing}
                onMouseOut={stopDrawing}
                onMouseUp={stopDrawing}
                onMouseMove={draw}
            />

            {latexExpression &&
                latexExpression.map((latex, index) => (
                    <Draggable
                        key={index}
                        defaultPosition={latexPosition}
                        onStop={(_e, data) =>
                            setLatexPosition({ x: data.x, y: data.y })
                        }
                    >
                        <div className="absolute p-2 text-white rounded shadow-md">
                            <div className="latex-content">{latex}</div>
                        </div>
                    </Draggable>
                ))}
        </>
    );
}
