import { ContactList, LockedContact, RequestContactForm, ShowContact, ViewBeacon } from "@/components/site/ContactSection";
import type { Locale } from "@/i18n/config";
import type { PublicEntity } from "@/lib/api/types";
import type { getDictionary } from "@/i18n/get-dictionary";

type Dict = Awaited<ReturnType<typeof getDictionary>>["contact"];

/**
 * The contact part of a place page. The server decided what to send: a place that does not gate contact comes with its details (readable without JavaScript), a subscribed
 * place in a gated category shows them through the logged Show contact call, and a locked one offers Request contact. Nothing here can change a score or a ranking.
 */
export function EntityContactBlock({ entity, lang, dict, returnPath }: { entity: PublicEntity; lang: Locale; dict: Dict; returnPath: string }) {
  let body: React.ReactNode = null;
  if (entity.contact) {
    body = <ContactList contact={entity.contact} dict={dict} />;
  } else if (entity.contactLocked) {
    body = (
      <LockedContact heading={dict.locked.heading} text={dict.locked.text}>
        <RequestContactForm lang={lang} entityId={entity.id} returnPath={returnPath} dict={dict.request} />
      </LockedContact>
    );
  } else if (entity.contactAvailable) {
    body = <ShowContact entityId={entity.id} dict={dict} />;
  }
  return (
    <>
      <ViewBeacon entityId={entity.id} />
      {body ? (
        <section aria-labelledby="contact" className="space-y-3">
          <h2 id="contact" className="font-heading text-xl font-semibold">
            {dict.heading}
          </h2>
          {body}
        </section>
      ) : null}
    </>
  );
}
