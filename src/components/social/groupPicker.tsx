import { FiFolder } from "react-icons/fi";
import { Dropdown } from "@/components/ui/dropdown";
import { ALL_FRIENDS, FavoriteGroupOption } from "@/libs/friendView";
import { useText } from "@/libs/social";

interface Props {
  groups: FavoriteGroupOption[];
  value: string;
  /** フレンド一覧の表示範囲として使うとき、先頭に「全フレンド」を出す */
  allowAll: boolean;
  label: string;
  onChange: (value: string) => void;
}

// お気に入りグループ（とフレンド一覧では「全フレンド」）を選ぶプルダウン。
export function GroupPicker({ groups, value, allowAll, label, onChange }: Props) {
  const t = useText();
  const options = [
    ...(allowAll ? [{ value: ALL_FRIENDS, label: t("全フレンド", "All friends") }] : []),
    ...(groups.length ? [] : [{ value: "", label: t("お気に入りグループ", "Favorite group") }]),
    ...groups.map((g) => ({ value: g.name, label: g.label })),
  ];
  return (
    <Dropdown
      className="group-picker"
      icon={<FiFolder aria-hidden="true" />}
      label={label}
      value={value}
      options={options}
      onChange={onChange}
    />
  );
}
