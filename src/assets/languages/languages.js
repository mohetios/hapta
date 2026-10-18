import en from './en.json'
import es from './es.json'
import ru from './ru.json'
import fr from './fr.json'
import pt from './pt.json'
import zh_cn from './zh-CN.json'
import zh_tw from './zh-TW.json'
import de from './de.json'
import it from './it.json'
import ar from './ar.json'
import fa from './fa.json'
import pl from './pl.json'
import ja from './ja.json'
import tr from './tr.json'
import uk from './uk.json'
import ko from './ko.json'
import hi from './hi.json'
import he from './he.json'
import vi from './vi.json'

export const defaultLocale = 'en'

// key = config.language, intl = BCP 47 tag for Intl / calendars
export const languages = {
    en: { name: 'English', dir: 'ltr', intl: 'en', messages: en },
    es: { name: 'Español', dir: 'ltr', intl: 'es', messages: es },
    fr: { name: 'Français', dir: 'ltr', intl: 'fr', messages: fr },
    de: { name: 'Deutsch', dir: 'ltr', intl: 'de', messages: de },
    it: { name: 'Italiano', dir: 'ltr', intl: 'it', messages: it },
    pt: { name: 'Português', dir: 'ltr', intl: 'pt', messages: pt },
    ru: { name: 'Русский', dir: 'ltr', intl: 'ru', messages: ru },
    hi: { name: 'हिंदी', dir: 'ltr', intl: 'hi', messages: hi },
    ja: { name: '日本語', dir: 'ltr', intl: 'ja', messages: ja },
    pl: { name: 'Polski', dir: 'ltr', intl: 'pl', messages: pl },
    ar: { name: 'العربية', dir: 'rtl', intl: 'ar', messages: ar },
    fa: { name: 'فارسی', dir: 'rtl', intl: 'fa', messages: fa },
    ko: { name: '한국어', dir: 'ltr', intl: 'ko', messages: ko },
    zh_cn: { name: '简体中文', dir: 'ltr', intl: 'zh-CN', messages: zh_cn },
    zh_tw: { name: '繁體中文', dir: 'ltr', intl: 'zh-TW', messages: zh_tw },
    uk: { name: 'Українська', dir: 'ltr', intl: 'uk', messages: uk },
    tr: { name: 'Türkçe', dir: 'ltr', intl: 'tr', messages: tr },
    vi: { name: 'Tiếng Việt', dir: 'ltr', intl: 'vi', messages: vi },
    he: { name: 'עברית', dir: 'rtl', intl: 'he', messages: he },
}

export const messages = Object.fromEntries(Object.entries(languages).map(([key, lang]) => [key, lang.messages]))
