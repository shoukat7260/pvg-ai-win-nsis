import { forwardRef } from "react";

type Surface = "dark" | "light";

export type PvgInputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  surface?: Surface;
  invalid?: boolean;
  success?: boolean;
  compact?: boolean;
};

/**
 * Shared readable text field — always sets explicit colors via `.pvg-input`.
 */
export const PvgInput = forwardRef<HTMLInputElement, PvgInputProps>(
  function PvgInput(
    {
      surface = "dark",
      invalid,
      success,
      compact,
      className = "",
      ...rest
    },
    ref,
  ) {
    const classes = [
      "pvg-input",
      surface === "light" ? "pvg-input--light" : "",
      compact ? "pvg-input--compact" : "",
      invalid ? "pvg-input--error" : "",
      success ? "pvg-input--success" : "",
      className,
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <input
        ref={ref}
        className={classes}
        aria-invalid={invalid ? true : undefined}
        {...rest}
      />
    );
  },
);

export type PvgTextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  surface?: Surface;
  invalid?: boolean;
};

export const PvgTextarea = forwardRef<HTMLTextAreaElement, PvgTextareaProps>(
  function PvgTextarea(
    { surface = "dark", invalid, className = "", ...rest },
    ref,
  ) {
    const classes = [
      "pvg-textarea",
      "pvg-input",
      surface === "light" ? "pvg-input--light" : "",
      invalid ? "pvg-input--error" : "",
      className,
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <textarea
        ref={ref}
        className={classes}
        aria-invalid={invalid ? true : undefined}
        {...rest}
      />
    );
  },
);
