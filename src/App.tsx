import Carousel from './components/Carousel';

const IMAGES = Array(8)
    .fill(0)
    .map((_, i) => ({
        image: `/images/image-${i + 1}.jpg`,
    }));

function App() {
    return (
        <div className="flex flex-wrap justify-between items-center mx-auto max-w-screen-xl p-4">
            <Carousel slides={IMAGES} />
        </div>
    );
}

export default App;
