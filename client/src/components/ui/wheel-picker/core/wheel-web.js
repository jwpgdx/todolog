import React, { useRef, useState, useEffect, memo } from 'react';
import { useKeenSlider } from 'keen-slider/react';
import 'keen-slider/keen-slider.min.css';

// 3D Wheel CSS (Embedded)
const wheel3DStyles = `
.wheel.keen-slider {
    display: block;
    color: #fff;
    height: 100%;
    overflow: visible;
    width: 100%;
}

.wheel--perspective-right .wheel__inner {
    perspective-origin: calc(50% + 100px) 50%;
    transform: translateX(10px);
    -webkit-transform: translateX(10px);
}

.wheel--perspective-left .wheel__inner {
    perspective-origin: calc(50% - 100px) 50%;
    transform: translateX(-10px);
    -webkit-transform: translateX(-10px);
}

.wheel__inner {
    display: flex;
    align-items: center;
    justify-content: center;
    perspective: 1000px;
    transform-style: preserve-3d;
    height: 16%;
    width: 100%;
}

.wheel__slides {
    height: 100%;
    position: relative;
    width: 100%;
}

.wheel__shadow-top,
.wheel__shadow-bottom {
    background: linear-gradient(to bottom,
            rgba(0, 0, 0, 0.9) 0%,
            rgba(0, 0, 0, 0.5) 100%);
    left: 0;
    height: calc(42% + 2px);
    width: 100%;
    border-bottom: 0.5px solid rgba(255, 255, 255, 0.3);
    position: relative;
    margin-top: -2px;
    z-index: 5;
    pointer-events: none;
}

.wheel__shadow-bottom {
    background: linear-gradient(to bottom,
            rgba(0, 0, 0, 0.5) 0%,
            rgba(0, 0, 0, 0.9) 100%);
    margin-top: 2px;
    border-bottom: none;
    border-top: 0.5px solid rgba(255, 255, 255, 0.3);
}

.wheel__label {
    font-weight: 500;
    font-size: 15px;
    line-height: 1;
    margin-top: 1px;
    margin-left: 5px;
}

.wheel__slide {
    align-items: center;
    backface-visibility: hidden;
    -webkit-backface-visibility: hidden;
    display: flex;
    font-size: 20px;
    font-weight: 400;
    height: 100%;
    width: 100%;
    position: absolute;
    justify-content: center;
}
`;

export const Wheel = memo(({ items = [], value, onChange, width, loop = true, perspective = "center", style }) => {
    const wheelSize = 20;
    const slides = items.length;
    const slideDegree = 360 / wheelSize;
    const slidesPerView = loop ? 9 : 1;

    const [sliderState, setSliderState] = useState(null);
    const size = useRef(0);

    const selectedIndex = items.findIndex(item => {
        const itemVal = typeof item === 'object' ? item.value : item;
        return itemVal === value;
    });
    const initialIndex = selectedIndex >= 0 ? selectedIndex : 0;

    // onChange 최신값 유지를 위한 Ref (불필요한 리렌더링/옵션 변경 방지)
    const onChangeRef = useRef(onChange);
    useEffect(() => {
        onChangeRef.current = onChange;
    }, [onChange]);

    // keen-slider 옵션 메모이제이션 (items.length, loop, initialIndex가 바뀔 때만 재생성)
    const options = React.useMemo(() => ({
        slides: {
            number: slides,
            origin: loop ? "center" : "auto",
            perView: slidesPerView,
            spacing: 0,
        },
        vertical: true,
        initial: initialIndex,
        loop: loop,
        dragSpeed: (val) => {
            const height = size.current;
            return (
                val *
                (height /
                    ((height / 2) * Math.tan(slideDegree * (Math.PI / 180))) /
                    slidesPerView)
            );
        },
        created: (s) => {
            size.current = s.size;
            setSliderState(s.track.details); // Ensure sliderState is set on creation
        },
        updated: (s) => {
            size.current = s.size;
        },
        detailsChanged: (s) => {
            setSliderState(s.track.details);
        },
        animationEnded: (s) => {
            const idx = s.track.details.rel;

            const item = items[idx];
            const itemVal = typeof item === 'object' ? item.value : item;
            if (onChangeRef.current) onChangeRef.current(itemVal);
        },
        rubberband: !loop,
        mode: "free-snap",
    }), [items.length, loop, initialIndex, slideDegree, slides]); // Added slides and slideDegree to dependencies

    const [sliderRef, slider] = useKeenSlider(options);
    const [radius, setRadius] = useState(0);

    useEffect(() => {
        if (slider.current) setRadius(slider.current.size / 2);
    }, [slider]);

    useEffect(() => {
        if (slider.current && value) {
            const idx = items.findIndex(item => {
                const itemVal = typeof item === 'object' ? item.value : item;
                return itemVal === value;
            });
            // Safe check for track and details
            const currentRel = slider.current.track?.details?.rel;
            if (idx >= 0 && currentRel !== undefined && currentRel !== idx) {
                slider.current.moveToIdx(idx);
            }
        }
    }, [value, items, slider]);

    function slideValues() {
        if (!sliderState) return [];
        const offset = loop ? 1 / 2 - 1 / slidesPerView / 2 : 0;

        const values = [];
        for (let i = 0; i < slides; i++) {
            const distance = sliderState
                ? (sliderState.slides[i].distance - offset) * slidesPerView
                : 0;
            const rotate =
                Math.abs(distance) > wheelSize / 2
                    ? 180
                    : distance * (360 / wheelSize) * -1;
            const style = {
                transform: `rotateX(${rotate}deg) translateZ(${radius}px)`,
                WebkitTransform: `rotateX(${rotate}deg) translateZ(${radius}px)`,
            };

            const item = items[i];
            const displayLabel = typeof item === 'object' ? item.label : item;

            values.push({ style, label: displayLabel, index: i });
        }
        return values;
    }

    return (
        <div
            className={"wheel keen-slider wheel--perspective-" + perspective}
            ref={sliderRef}
            style={{
                width: width ? `${width}px` : undefined,
                flex: width ? undefined : 1,
                height: '100%',
                ...style
            }}
        >
            <div
                className="wheel__shadow-top"
                style={{
                    transform: `translateZ(${radius}px)`,
                    WebkitTransform: `translateZ(${radius}px)`,
                }}
            />
            <div className="wheel__inner">
                <div className="wheel__slides" style={{ width: width ? `${width}px` : '100%' }}>
                    {slideValues().map(({ style, label, index }) => (
                        <div className="wheel__slide" style={style} key={index}>
                            <span>{label}</span>
                        </div>
                    ))}
                </div>
            </div>
            <div
                className="wheel__shadow-bottom"
                style={{
                    transform: `translateZ(${radius}px)`,
                    WebkitTransform: `translateZ(${radius}px)`,
                }}
            />
        </div>
    );
});

export function Picker({ children, style, className }) {
    return (
        <>
            <style>{wheel3DStyles}</style>
            <div
                className={`wheel-picker-container ${className || ''}`}
                data-vaul-no-drag
                style={{
                    height: '240px',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    background: '#000',
                    borderRadius: '12px',
                    width: '100%',
                    overflow: 'hidden',
                    position: 'relative',
                    ...style
                }}
            >
                {children}
            </div>
        </>
    );
}
