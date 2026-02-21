export type ShoppingLocale = 'en-US' | 'pl-PL';

export interface StoreLink {
    url: string;
    isMock: boolean;
}

// Replace these with actual affiliate codes in production
const AFFILIATE_CODES = {
    Amazon: '&tag=homelabbuilder-20',
    AmazonPL: '&tag=homelabbuilderpl-21',
    Allegro: '&bi_s=homelabbuilder&bi_m=search',
    eBay: '&mkcid=1&mkrid=711-53200-19255-0&campid=5338900000',
};

const BASE_URLS = {
    'en-US': {
        Amazon: 'https://www.amazon.com/s?k=',
        eBay: 'https://www.ebay.com/sch/i.html?_nkw=',
    },
    'pl-PL': {
        Allegro: 'https://allegro.pl/listing?string=',
        OLX: 'https://www.olx.pl/oferty/q-',
        AmazonPL: 'https://www.amazon.pl/s?k=',
        XKom: 'https://www.x-kom.pl/szukaj?q=',
    }
};

export const linkGenerator = {
    generate(store: string, query: string, locale: ShoppingLocale = 'en-US'): StoreLink {
        const q = encodeURIComponent(query);
        let url = '#';

        if (locale === 'pl-PL') {
            if (store.includes('Allegro')) url = `${BASE_URLS['pl-PL'].Allegro}${q}${AFFILIATE_CODES.Allegro}`;
            else if (store.includes('Amazon')) url = `${BASE_URLS['pl-PL'].AmazonPL}${q}${AFFILIATE_CODES.AmazonPL}`;
            else if (store === 'x-kom') url = `${BASE_URLS['pl-PL'].XKom}${q}`;
            else if (store.includes('OLX')) url = `${BASE_URLS['pl-PL'].OLX}${q}/`;
        } else {
            if (store.includes('Amazon')) url = `${BASE_URLS['en-US'].Amazon}${q}${AFFILIATE_CODES.Amazon}`;
            else if (store.includes('eBay')) url = `${BASE_URLS['en-US'].eBay}${q}${AFFILIATE_CODES.eBay}`;
        }

        return {
            url,
            isMock: false
        };
    }
};
