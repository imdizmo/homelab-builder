
export type ShoppingLocale = 'en-US' | 'pl-PL';

export interface StoreLink {
    url: string;
    isMock: boolean;
}

const BASE_URLS = {
    'en-US': {
        Amazon: 'https://www.amazon.de/s?k=',
        eBay: 'https://www.ebay.com/sch/i.html?_nkw=',
    },
    'pl-PL': {
        Allegro: 'https://allegro.pl/listing?string=',
        AmazonPL: 'https://www.amazon.pl/s?k=',
        XKom: 'https://www.x-kom.pl/szukaj?q=',
    }
};

export const linkGenerator = {
    generate(store: string, query: string, locale: ShoppingLocale = 'en-US'): StoreLink {
        const q = encodeURIComponent(query);
        let url = '#';

        if (locale === 'pl-PL') {
            if (store === 'Allegro') url = `${BASE_URLS['pl-PL'].Allegro}${q}`;
            else if (store === 'Amazon') url = `${BASE_URLS['pl-PL'].AmazonPL}${q}`;
            else if (store === 'x-kom') url = `${BASE_URLS['pl-PL'].XKom}${q}`;
            else if (store.startsWith('Allegro')) url = `${BASE_URLS['pl-PL'].Allegro}${q}`; // Allegro (Used) etc.
        } else {
            if (store === 'Amazon') url = `${BASE_URLS['en-US'].Amazon}${q}`;
            else if (store === 'eBay') url = `${BASE_URLS['en-US'].eBay}${q}`;
        }

        // Fallback for cross-locale (e.g. asking for Allegro in US mode?) 
        // Logic in generator.ts handles which stores are asked for.

        return {
            url,
            isMock: true // We are just searching, not linking to specific item ID yet
        };
    }
};
