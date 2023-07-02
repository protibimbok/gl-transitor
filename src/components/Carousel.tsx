import { useEffect, useRef, useState } from 'react';
import { classNames } from '../utils/ui';
import { ShaderTransitionArray } from '../../lib/src/main';
import all from '../../lib/src/shaders/index';

interface CarouselProps {
    slides: {
        image: string;
        heading?: string;
        text?: string;
    }[];
}

export default function Carousel({ slides }: CarouselProps) {
    const [active, setActive] = useState(0);
    const slider = useRef<ShaderTransitionArray>();
    const canvas = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        if (canvas.current) {
            slider.current = ShaderTransitionArray.init(
                canvas.current,
                all,
                //@ts-expect-error why?
                canvas.current.nextElementSibling?.querySelectorAll('img')
            );
        }
        return () => {
            if (slider.current) {
                slider.current.dispose();
            }
        };
    }, []);

    const change = (next: number) => {
        if (next === active || !slider.current) {
            return;
        }
        slider.current.toIndex(next).then((active) => setActive(active));
    };

    return (
        <div className="relative w-full rounded overflow-hidden">
            <canvas
                className="absolute inset-0 h-full w-full"
                ref={canvas}
            ></canvas>
            <div className="relative pt-[50%] overflow-hidden invisible">
                {slides.map((slide, idx) => (
                    <div className="absolute inset-0 h-full w-full" key={idx}>
                        <img
                            data-idx={idx}
                            src={slide.image}
                            alt=""
                            className={classNames({
                                'h-full w-full object-cover object-top': true,
                                invisible: active !== idx,
                            })}
                        />
                    </div>
                ))}
            </div>
            <div className="w-max left-1/2 -translate-x-1/2 absolute bottom-5 flex justify-center gap-3">
                {slides.map((_, i) => (
                    <button
                        key={i}
                        type="button"
                        className={classNames({
                            'w-3 h-3 rounded-full bg-white ring-4 ring-black hover:ring-blue-300':
                                true,
                            'ring-blue-500': active === i,
                        })}
                        onClick={() => change(i)}
                    ></button>
                ))}
            </div>
            <button
                type="button"
                className="absolute top-0 left-0 z-30 flex items-center justify-center h-full px-4 cursor-pointer group focus:outline-none"
                onClick={() => change(active - 1)}
            >
                <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-white/30/30 group-hover:bg-white/50/60 group-focus:ring-4 group-focus:ring-white/70 group-focus:outline-none">
                    <svg
                        aria-hidden="true"
                        className="w-6 h-6 text-white"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        xmlns="http://www.w3.org/2000/svg"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M15 19l-7-7 7-7"
                        ></path>
                    </svg>
                    <span className="sr-only">Previous</span>
                </span>
            </button>
            <button
                type="button"
                className="absolute top-0 right-0 z-30 flex items-center justify-center h-full px-4 cursor-pointer group focus:outline-none"
                onClick={() => change(active + 1)}
            >
                <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-white/30/30 group-hover:bg-white/50/60 group-focus:ring-4 group-focus:ring-white/70 group-focus:outline-none">
                    <svg
                        aria-hidden="true"
                        className="w-6 h-6 text-white"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        xmlns="http://www.w3.org/2000/svg"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M9 5l7 7-7 7"
                        ></path>
                    </svg>
                    <span className="sr-only">Next</span>
                </span>
            </button>
        </div>
    );
}
