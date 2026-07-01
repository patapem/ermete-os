Name:           ermete-system-tweaks
Version:        1.0.0
Release:        1%{?dist}
Summary:        Configurazioni di sistema e tweak per Ermete OS

License:        MIT
Source0:        override.conf

BuildArch:      noarch

%description
Pacchetto dedicato alle configurazioni architetturali di base per Ermete OS,
tra cui l'override del servizio bootc per disabilitare il riavvio automatico
durante gli aggiornamenti di sistema.

%prep
# Nulla da preparare

%build
# Nulla da compilare

%install
mkdir -p %{buildroot}/usr/lib/systemd/system/bootc-fetch-apply-updates.service.d/
cp %{SOURCE0} %{buildroot}/usr/lib/systemd/system/bootc-fetch-apply-updates.service.d/override.conf

%files
/usr/lib/systemd/system/bootc-fetch-apply-updates.service.d/override.conf

%changelog
* Wed Jul 01 2026 Ermete Bot <bot@ermete.os> - 1.0.0-1
- Creazione pacchetto per implementazione stage update di bootc
