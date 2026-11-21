import { useEffect, useId, useRef, useState } from "react";
import { FiChevronDown } from "react-icons/fi";
import { usePopover } from "@/libs/usePopover";

export interface DropdownOption<T extends string> {
  value: T;
  label: string;
}

interface Props<T extends string> {
  value: T;
  options: DropdownOption<T>[];
  onChange: (value: T) => void;
  /** 読み上げ用の名前（見出しや項目名）。ボタンは「名前＋選択中の値」で読み上げる */
  label: string;
  /** ボタンの先頭に置くアイコン */
  icon?: React.ReactNode;
  /** 一覧をボタンの右端に揃える（画面の右側に置くとき） */
  alignEnd?: boolean;
  className?: string;
  disabled?: boolean;
}

// OS に関係なく同じ見た目で開くプルダウン。<select> の一覧は OS（WebView）が描くため、
// ボタンと一覧（role="listbox"）を自前で描いて、矢印キー・Enter・Esc・頭文字での移動に対応する。
export function Dropdown<T extends string>(props: Props<T>) {
  const { value, options, onChange, label, icon, alignEnd, className, disabled } = props;
  const menu = usePopover<"list">();
  const open = menu.open === "list";
  const selectedIndex = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );
  const [active, setActive] = useState(selectedIndex);
  const trigger = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const id = useId();
  const current = options.find((o) => o.value === value);

  // 開いたら一覧へフォーカスを移し、選択中（またはキーで移動した先）の項目を見える位置に出す。
  useEffect(() => {
    if (open) list.current?.focus();
  }, [open]);
  useEffect(() => {
    if (open) document.getElementById(`${id}-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [open, active, id]);

  function show(index = selectedIndex) {
    if (!options.length) return;
    setActive(index);
    menu.show("list");
  }
  function close() {
    menu.close();
    trigger.current?.focus();
  }
  function choose(index: number) {
    const option = options[index];
    close();
    if (option && option.value !== value) onChange(option.value);
  }
  // 入力した文字で始まる次の項目へ移る。
  function jumpTo(key: string) {
    const lower = key.toLocaleLowerCase();
    for (let step = 1; step <= options.length; step++) {
      const index = (active + step) % options.length;
      if (options[index].label.toLocaleLowerCase().startsWith(lower)) return setActive(index);
    }
  }

  function onTriggerKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      show();
    }
  }
  function onListKey(e: React.KeyboardEvent) {
    const last = options.length - 1;
    const moves: Record<string, number> = {
      ArrowDown: Math.min(active + 1, last),
      ArrowUp: Math.max(active - 1, 0),
      Home: 0,
      End: last,
      PageDown: Math.min(active + 5, last),
      PageUp: Math.max(active - 5, 0),
    };
    if (e.key in moves) {
      e.preventDefault();
      setActive(moves[e.key]);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      choose(active);
    } else if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "Tab") {
      menu.close();
    } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      jumpTo(e.key);
    }
  }

  return (
    <div className={"dropdown" + (className ? " " + className : "")} ref={menu.container}>
      <span id={`${id}-label`} className="sr-only">
        {label}
      </span>
      <button
        ref={trigger}
        type="button"
        className="dropdown-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? `${id}-list` : undefined}
        aria-labelledby={`${id}-label ${id}-value`}
        disabled={disabled}
        onClick={() => (open ? menu.close() : show())}
        onKeyDown={onTriggerKey}
      >
        {icon}
        <span id={`${id}-value`} className="dropdown-value">
          {current?.label ?? ""}
        </span>
        <FiChevronDown className="dropdown-chevron" aria-hidden="true" />
      </button>
      {open && (
        <ul
          ref={list}
          id={`${id}-list`}
          role="listbox"
          tabIndex={-1}
          aria-labelledby={`${id}-label`}
          aria-activedescendant={`${id}-${active}`}
          className={"dropdown-list" + (alignEnd ? " align-end" : "")}
          onKeyDown={onListKey}
        >
          {options.map((option, index) => (
            <li
              key={option.value}
              id={`${id}-${index}`}
              role="option"
              aria-selected={option.value === value}
              data-active={index === active || undefined}
              onPointerMove={() => setActive(index)}
              onClick={() => choose(index)}
            >
              {option.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
