import ticket from '../../media/icon-ticket.svg';
import { maskOf } from './Bough';

// An idle ticket: the olive sprig (κλαδί) from media/icon-ticket.svg, in the text colour.
export function Sprig() {
  return <span className="mask-icon sprig" style={maskOf(ticket)} role="img" aria-label="idle" />;
}
