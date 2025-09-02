import Image from 'next/image';

const Loader = () => {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-background z-50">
      <div className="animate-pulse">
        <Image
          src="/rplogo.png"
          alt="Loading..."
          width={150}
          height={150}
          priority
        />
      </div>
    </div>
  );
};

export default Loader;
