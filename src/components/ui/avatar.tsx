export function Avatar({ src, className }: { src: string; className?: string }) {
    return (
      <div className={`avatar ${className}`}>
        <div className="w-10 rounded-full">
          <img src={src} alt="avatar" />
        </div>
      </div>
    );
  }