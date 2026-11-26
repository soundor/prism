export function Player() {
  return (
    <iframe
      src={`${import.meta.env.BASE_URL}embed/index.html`}
      title="Soundor Prism, playable in the browser"
      allow="autoplay"
      className="block aspect-[640/470] max-h-[80vh] min-h-68 w-full rounded-xl border bg-black"
    />
  );
}
