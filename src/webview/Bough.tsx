import epic from '../../media/icon-epic.svg';

// An epic: the olive branch from media/icon-epic.svg, painted in the text colour.
export function Bough() {
  return <span className="mask-icon bough" style={maskOf(epic)} role="img" aria-label="epic" />;
}

// The file's shape, filled with the text colour, so it follows the theme. The build puts the
// SVG in as plain text, quotes and all; a raw " would end the CSS url("…") early.
export const maskOf = (url: string) => {
  const css = `url("${url.replace(/"/g, '%22')}")`;
  return { maskImage: css, WebkitMaskImage: css };
};
