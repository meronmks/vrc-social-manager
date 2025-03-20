export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
    return (
      <input
        className={`input input-bordered ${className}`}
        {...props}
      />
    );
  }