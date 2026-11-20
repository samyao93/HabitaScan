/* Réduction des images avant envoi (taille et poids). */

/* Réduit une capture à 1 280 px de large au maximum, en JPEG, pour limiter l'envoi */
export function reduireImage(source) {
  return new Promise((ok, ko) => {
    const im = new Image();
    const dataUrl = typeof source === "string" ? source : URL.createObjectURL(source);
    im.onload = () => {
      const k = Math.min(1, 1280 / Math.max(im.width, 1));
      const c = document.createElement("canvas");
      c.width = Math.round(im.width * k);
      c.height = Math.round(im.height * k);
      c.getContext("2d").drawImage(im, 0, 0, c.width, c.height);
      ok(c.toDataURL("image/jpeg", 0.8).split(",")[1]);
    };
    im.onerror = ko;
    im.src = dataUrl;
  });
}
