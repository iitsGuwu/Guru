export type CommunityProject = {
  name: string
  url: string
  tagline: string
  description: string
  stats: string[]
}

export const communityProjects: CommunityProject[] = [
  {
    name: "$GOLO",
    url: "https://gboy.golo.wtf",
    tagline: "Deflationary Token",
    description:
      "A deflationary token for $GBOY, built for the @neukoai ecosystem. Tracks live stats, burns, and supply metrics on the official dashboard.",
    stats: ["Deflationary Mechanism", "Live Burns", "Community Driven"],
  },
  {
    name: "Harmie",
    url: "https://harmie.xyz",
    tagline: "Pageant Platform",
    description:
      "A pageant for the 1-of-1 collection of Harmies, launched for Neuko and the Harmony project. Vote and celebrate the most charming Harmie.",
    stats: ["1/1 Collection", "Community Voting", "Harmony Project"],
  },
]
