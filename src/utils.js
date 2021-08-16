export function currentDateStamp() {
	// Thanks https://stackoverflow.com/a/3552493/1597274

	function join(t, a, s) {
		function format(m) {
			let f = new Intl.DateTimeFormat('en', m);
			return f.format(t);
		}
		return a.map(format).join(s);
	}

	let a = [{ day: 'numeric' }, { month: 'short' }, { year: 'numeric' }];
	return join(new Date, a, '-');
}
