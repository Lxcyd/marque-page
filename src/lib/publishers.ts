/** Editeurs grand public francais : l'edition qu'on a le plus de chances d'avoir en main. */
export const KNOWN_PUBLISHER =
  /gallimard|folio|livre de poche|flammarion|\bgf\b|pocket|\bpoints\b|seuil|grasset|albin michel|actes sud|babel|minuit|\bp\.?o\.?l\b|\bstock\b|fayard|julliard|laffont|j'ai lu|10\s*\/\s*18|rivages|verticales|l'olivier|deno[eë]l|\bplon\b|presses de la cit|calmann|latt[eè]s|belfond|zulma|philippe rey|wespieser|liana levi|mercure de france|bourgois|libretto|garnier|hachette|nathan|bayard|l'[eé]cole des loisirs|casterman|dargaud|dupuis|gl[eé]nat|delcourt/i;

/** Editions a eviter en vitrine : livres audio, auto-edition, reimpressions a la demande. */
export const POOR_PUBLISHER =
  /audible|audio|independently published|createspace|lulu|books on demand|\bbod\b|kessinger|forgotten books|nabu|hansebooks|wentworth|matrix|norph|ripol|рипол/i;

/** Parmi les editeurs d'une oeuvre, le plus parlant : connu > quelconque > a eviter. */
export const pickPublisher = (list: string[] = []) =>
  list.find((p) => KNOWN_PUBLISHER.test(p)) ?? list.find((p) => !POOR_PUBLISHER.test(p)) ?? list[0];
