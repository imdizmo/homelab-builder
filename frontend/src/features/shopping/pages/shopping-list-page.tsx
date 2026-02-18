import { useState } from "react"
import { useBuilderStore } from "../../builder/store/builder-store"
import { generateShoppingList } from "../lib/generator"
import { Button } from "../../../components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card"
import { Printer, ShoppingCart, Globe, ExternalLink } from "lucide-react"
import { Badge } from "../../../components/ui/badge"

export default function ShoppingListPage() {
  const { selectedServices, hardwareNodes } = useBuilderStore()
  const [locale, setLocale] = useState<'en-US' | 'pl-PL'>('en-US')

  const items = generateShoppingList(selectedServices, hardwareNodes)

  // Quick total estimation (taking lowest price for each item)
  const totalCost = items.reduce((acc, item) => {
    const prices = item.offers.map(o => o.currency === 'PLN' ? o.price / 4 : o.price) // rough normalize to EUR/USD for total
    return acc + (Math.min(...prices) || 0)
  }, 0)

  const handlePrint = () => window.print()

  if (selectedServices.length === 0) {
      return (
          <div className="flex flex-col items-center justify-center p-12 text-center border rounded-lg bg-muted/20">
            <ShoppingCart className="h-12 w-12 mb-4 text-muted-foreground" />
            <h3 className="text-lg font-bold">Your shopping list is empty</h3>
            <p className="text-sm text-muted-foreground mb-4">Select services from the catalog to generate a list.</p>
            <Button asChild onClick={() => window.location.href='/services'}>
               <div>Go to Catalog</div>
            </Button>
          </div>
      )
  }

  return (
    <div className="space-y-6 print:space-y-4">
      <div className="flex items-center justify-between print:hidden">
        <div>
            <h1 className="text-3xl font-bold tracking-tight">Shopping List & Part Finder</h1>
            <p className="text-muted-foreground">Detailed hardware recommendations with price comparison.</p>
        </div>
        <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setLocale(l => l === 'en-US' ? 'pl-PL' : 'en-US')}>
                <Globe className="mr-2 h-4 w-4" />
                {locale === 'en-US' ? 'International' : 'Poland (PLN)'}
            </Button>
            <Button onClick={handlePrint}>
                <Printer className="mr-2 h-4 w-4" /> Print
            </Button>
        </div>
      </div>

      <div className="grid gap-6">
        {items.map((item, index) => (
            <Card key={index} className="overflow-hidden">
                <CardHeader className="bg-muted/50 pb-4">
                    <div className="flex items-center justify-between">
                        <div className="space-y-1">
                            <CardTitle className="flex items-center gap-2">
                                {item.name}
                                <Badge variant={item.priority === 'essential' ? 'default' : 'secondary'}>
                                    {item.priority}
                                </Badge>
                                <span className="text-xs font-normal text-muted-foreground px-2 py-0.5 rounded-full border bg-background">
                                    {item.category}
                                </span>
                            </CardTitle>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="divide-y">
                        {item.offers.map((offer, i) => (
                            <div key={i} className="flex items-center justify-between p-4 hover:bg-muted/20 transition-colors">
                                <div className="flex items-center gap-4">
                                    <div className="font-semibold w-24">{offer.store}</div>
                                    <Badge variant={offer.condition === 'new' ? 'outline' : 'secondary'} className="capitalize">
                                        {offer.condition}
                                    </Badge>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="font-bold text-lg">
                                        {offer.price} <span className="text-xs font-normal text-muted-foreground">{offer.currency}</span>
                                    </div>
                                    <Button size="sm" asChild>
                                        <a href={offer.url} target="_blank" rel="noreferrer">
                                            Buy <ExternalLink className="ml-2 h-3 w-3" />
                                        </a>
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        ))}
      </div>
      
      <div className="flex justify-end pt-4 border-t print:hidden">
          <div className="text-right">
              <div className="text-sm text-muted-foreground">Estimated Total (Lowest Offers)</div>
              <div className="text-2xl font-bold text-primary">
                  ~{Math.round(totalCost)} EUR/USD
              </div>
          </div>
      </div>

      <div className="hidden print:block text-center text-sm text-muted-foreground mt-8">
        Generated by Homelab Builder - {new Date().toLocaleDateString()}
      </div>
    </div>
  )
}
