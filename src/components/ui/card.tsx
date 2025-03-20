export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
    return (
      <div className={`card bg-base-100 shadow-md ${className}`}>{children}</div>
    );
  }
  
  export function CardContent({ className, children }: { className?: string; children: React.ReactNode }) {
    return <div className={`card-body ${className}`}>{children}</div>;
  }