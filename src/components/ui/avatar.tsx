export function Avatar({ src, className }: { src: string; className?: string }) {
    return (
      <div className="avatar">
        <div className={`rounded-full ${className}`}>
          <img src={src} alt="avatar" className="w-full h-full object-cover" />
        </div>
      </div>
    );
  }