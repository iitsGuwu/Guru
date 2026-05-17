/**
 * Static gallery card for a catalog piece that is NOT currently on auction.
 * Same chrome as `AuctionCard` (border + native-ratio image + title strip)
 * minus the bid link/status, so the grid reads as one consistent gallery.
 * Image + name are pre-resolved in `lib/catalog.ts`, so this is a plain
 * presentational component.
 */
import { AuctionCardImage } from "./AuctionCardImage"
import type { CatalogItem } from "@/lib/catalog"

export function CatalogCard({ item }: { item: CatalogItem }) {
  return (
    <div className="group relative border border-gray-200 hover:border-gray-400 transition-colors">
      <AuctionCardImage src={item.image} alt={item.name} />
      <div className="p-4 flex items-center justify-between gap-2">
        <p className="text-base font-medium leading-tight truncate">
          {item.name}
        </p>
        <span className="text-[10px] font-mono uppercase tracking-wider shrink-0 whitespace-nowrap text-gray-500">
          {item.collectionName}
        </span>
      </div>
    </div>
  )
}
