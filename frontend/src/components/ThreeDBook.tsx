import React from 'react';

interface ThreeDBookProps {
    src: string;
    alt: string;
    className?: string;
    width?: string;
    height?: string;
    spineColor?: string;
}

const ThreeDBook: React.FC<ThreeDBookProps> = ({
    src,
    alt,
    className = "",
    spineColor = "#1a1a1a"
}) => {
    return (
        <div className={`book-scene ${className}`}>
            <div
                className="book"
                style={{
                    height: '100%',
                    aspectRatio: '2/3', // Enforce standard novel proportion
                    width: 'auto',
                    maxWidth: '100%'
                    // The Flexbox in .book-scene will center this fixed-ratio element
                }}
            >
                {/* Front Cover */}
                <div className="face-front">
                    <img
                        src={src}
                        alt={alt}
                        className="w-full h-full object-cover rounded-[1px]"
                    />
                    <div className="effect-spine-groove"></div>
                </div>

                {/* Back Cover */}
                <div className="face-back"></div>

                {/* Spine */}
                <div className="face-spine" style={{ backgroundColor: spineColor }}>
                    <span className="spine-title truncate">{alt}</span>
                </div>

                {/* Pages Container */}
                <div className="book-pages-container">
                    <div className="pages-right"></div>
                    <div className="pages-top"></div>
                    <div className="pages-bottom"></div>
                </div>

                {/* Shadow */}
                <div className="book-shadow"></div>
            </div>
        </div>
    );
};

export default ThreeDBook;
