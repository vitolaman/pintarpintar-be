import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeedMasterCountry1724160289473 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO master_country (country_name) VALUES ('Afghanistan');
      INSERT INTO master_country (country_name) VALUES ('Albania');
      INSERT INTO master_country (country_name) VALUES ('Algeria');
      INSERT INTO master_country (country_name) VALUES ('American Samoa');
      INSERT INTO master_country (country_name) VALUES ('Andorra');
      INSERT INTO master_country (country_name) VALUES ('Angola');
      INSERT INTO master_country (country_name) VALUES ('Anguilla');
      INSERT INTO master_country (country_name) VALUES ('Antarctica');
      INSERT INTO master_country (country_name) VALUES ('Antigua and Barbuda');
      INSERT INTO master_country (country_name) VALUES ('Argentina');
      INSERT INTO master_country (country_name) VALUES ('Armenia');
      INSERT INTO master_country (country_name) VALUES ('Aruba');
      INSERT INTO master_country (country_name) VALUES ('Australia');
      INSERT INTO master_country (country_name) VALUES ('Austria');
      INSERT INTO master_country (country_name) VALUES ('Azerbaijan');
      INSERT INTO master_country (country_name) VALUES ('Bahamas');
      INSERT INTO master_country (country_name) VALUES ('Bahrain');
      INSERT INTO master_country (country_name) VALUES ('Bangladesh');
      INSERT INTO master_country (country_name) VALUES ('Barbados');
      INSERT INTO master_country (country_name) VALUES ('Belarus');
      INSERT INTO master_country (country_name) VALUES ('Belgium');
      INSERT INTO master_country (country_name) VALUES ('Belize');
      INSERT INTO master_country (country_name) VALUES ('Benin');
      INSERT INTO master_country (country_name) VALUES ('Bermuda');
      INSERT INTO master_country (country_name) VALUES ('Bhutan');
      INSERT INTO master_country (country_name) VALUES ('Bosnia and Herzegovina');
      INSERT INTO master_country (country_name) VALUES ('Botswana');
      INSERT INTO master_country (country_name) VALUES ('Bouvet Island');
      INSERT INTO master_country (country_name) VALUES ('Brazil');
      INSERT INTO master_country (country_name) VALUES ('British Indian Ocean Territory');
      INSERT INTO master_country (country_name) VALUES ('Brunei Darussalam');
      INSERT INTO master_country (country_name) VALUES ('Bulgaria');
      INSERT INTO master_country (country_name) VALUES ('Burkina Faso');
      INSERT INTO master_country (country_name) VALUES ('Burundi');
      INSERT INTO master_country (country_name) VALUES ('Cambodia');
      INSERT INTO master_country (country_name) VALUES ('Cameroon');
      INSERT INTO master_country (country_name) VALUES ('Canada');
      INSERT INTO master_country (country_name) VALUES ('Cape Verde');
      INSERT INTO master_country (country_name) VALUES ('Cayman Islands');
      INSERT INTO master_country (country_name) VALUES ('Central African Republic');
      INSERT INTO master_country (country_name) VALUES ('Chad');
      INSERT INTO master_country (country_name) VALUES ('Chile');
      INSERT INTO master_country (country_name) VALUES ('China');
      INSERT INTO master_country (country_name) VALUES ('Christmas Island');
      INSERT INTO master_country (country_name) VALUES ('Cocos (Keeling) Islands');
      INSERT INTO master_country (country_name) VALUES ('Colombia');
      INSERT INTO master_country (country_name) VALUES ('Comoros');
      INSERT INTO master_country (country_name) VALUES ('Congo');
      INSERT INTO master_country (country_name) VALUES ('Cook Islands');
      INSERT INTO master_country (country_name) VALUES ('Costa Rica');
      INSERT INTO master_country (country_name) VALUES ('Croatia');
      INSERT INTO master_country (country_name) VALUES ('Cuba');
      INSERT INTO master_country (country_name) VALUES ('Cyprus');
      INSERT INTO master_country (country_name) VALUES ('Czech Republic');
      INSERT INTO master_country (country_name) VALUES ('Denmark');
      INSERT INTO master_country (country_name) VALUES ('Djibouti');
      INSERT INTO master_country (country_name) VALUES ('Dominica');
      INSERT INTO master_country (country_name) VALUES ('Dominican Republic');
      INSERT INTO master_country (country_name) VALUES ('Ecuador');
      INSERT INTO master_country (country_name) VALUES ('Egypt');
      INSERT INTO master_country (country_name) VALUES ('El Salvador');
      INSERT INTO master_country (country_name) VALUES ('Equatorial Guinea');
      INSERT INTO master_country (country_name) VALUES ('Eritrea');
      INSERT INTO master_country (country_name) VALUES ('Estonia');
      INSERT INTO master_country (country_name) VALUES ('Ethiopia');
      INSERT INTO master_country (country_name) VALUES ('Falkland Islands (Malvinas)');
      INSERT INTO master_country (country_name) VALUES ('Faroe Islands');
      INSERT INTO master_country (country_name) VALUES ('Fiji');
      INSERT INTO master_country (country_name) VALUES ('Finland');
      INSERT INTO master_country (country_name) VALUES ('France');
      INSERT INTO master_country (country_name) VALUES ('French Guiana');
      INSERT INTO master_country (country_name) VALUES ('French Polynesia');
      INSERT INTO master_country (country_name) VALUES ('French Southern Territories');
      INSERT INTO master_country (country_name) VALUES ('Gabon');
      INSERT INTO master_country (country_name) VALUES ('Gambia');
      INSERT INTO master_country (country_name) VALUES ('Georgia');
      INSERT INTO master_country (country_name) VALUES ('Germany');
      INSERT INTO master_country (country_name) VALUES ('Ghana');
      INSERT INTO master_country (country_name) VALUES ('Gibraltar');
      INSERT INTO master_country (country_name) VALUES ('Greece');
      INSERT INTO master_country (country_name) VALUES ('Greenland');
      INSERT INTO master_country (country_name) VALUES ('Grenada');
      INSERT INTO master_country (country_name) VALUES ('Guadeloupe');
      INSERT INTO master_country (country_name) VALUES ('Guam');
      INSERT INTO master_country (country_name) VALUES ('Guatemala');
      INSERT INTO master_country (country_name) VALUES ('Guernsey');
      INSERT INTO master_country (country_name) VALUES ('Guinea');
      INSERT INTO master_country (country_name) VALUES ('Guinea-Bissau');
      INSERT INTO master_country (country_name) VALUES ('Guyana');
      INSERT INTO master_country (country_name) VALUES ('Haiti');
      INSERT INTO master_country (country_name) VALUES ('Heard Island and McDonald Islands');
      INSERT INTO master_country (country_name) VALUES ('Holy See (Vatican City State)');
      INSERT INTO master_country (country_name) VALUES ('Honduras');
      INSERT INTO master_country (country_name) VALUES ('Hong Kong');
      INSERT INTO master_country (country_name) VALUES ('Hungary');
      INSERT INTO master_country (country_name) VALUES ('Iceland');
      INSERT INTO master_country (country_name) VALUES ('India');
      INSERT INTO master_country (country_name) VALUES ('Indonesia');
      INSERT INTO master_country (country_name) VALUES ('Iran');
      INSERT INTO master_country (country_name) VALUES ('Iraq');
      INSERT INTO master_country (country_name) VALUES ('Ireland');
      INSERT INTO master_country (country_name) VALUES ('Isle of Man');
      INSERT INTO master_country (country_name) VALUES ('Israel');
      INSERT INTO master_country (country_name) VALUES ('Italy');
      INSERT INTO master_country (country_name) VALUES ('Jamaica');
      INSERT INTO master_country (country_name) VALUES ('Japan');
      INSERT INTO master_country (country_name) VALUES ('Jersey');
      INSERT INTO master_country (country_name) VALUES ('Jordan');
      INSERT INTO master_country (country_name) VALUES ('Kazakhstan');
      INSERT INTO master_country (country_name) VALUES ('Kenya');
      INSERT INTO master_country (country_name) VALUES ('Kiribati');
      INSERT INTO master_country (country_name) VALUES ('Kuwait');
      INSERT INTO master_country (country_name) VALUES ('Kyrgyzstan');
      INSERT INTO master_country (country_name) VALUES ('Lao Peoples Democratic Republic');
      INSERT INTO master_country (country_name) VALUES ('Latvia');
      INSERT INTO master_country (country_name) VALUES ('Lebanon');
      INSERT INTO master_country (country_name) VALUES ('Lesotho');
      INSERT INTO master_country (country_name) VALUES ('Liberia');
      INSERT INTO master_country (country_name) VALUES ('Libya');
      INSERT INTO master_country (country_name) VALUES ('Liechtenstein');
      INSERT INTO master_country (country_name) VALUES ('Lithuania');
      INSERT INTO master_country (country_name) VALUES ('Luxembourg');
      INSERT INTO master_country (country_name) VALUES ('Macao');
      INSERT INTO master_country (country_name) VALUES ('Madagascar');
      INSERT INTO master_country (country_name) VALUES ('Malawi');
      INSERT INTO master_country (country_name) VALUES ('Malaysia');
      INSERT INTO master_country (country_name) VALUES ('Maldives');
      INSERT INTO master_country (country_name) VALUES ('Mali');
      INSERT INTO master_country (country_name) VALUES ('Malta');
      INSERT INTO master_country (country_name) VALUES ('Marshall Islands');
      INSERT INTO master_country (country_name) VALUES ('Martinique');
      INSERT INTO master_country (country_name) VALUES ('Mauritania');
      INSERT INTO master_country (country_name) VALUES ('Mauritius');
      INSERT INTO master_country (country_name) VALUES ('Mayotte');
      INSERT INTO master_country (country_name) VALUES ('Mexico');
      INSERT INTO master_country (country_name) VALUES ('Monaco');
      INSERT INTO master_country (country_name) VALUES ('Mongolia');
      INSERT INTO master_country (country_name) VALUES ('Montenegro');
      INSERT INTO master_country (country_name) VALUES ('Montserrat');
      INSERT INTO master_country (country_name) VALUES ('Morocco');
      INSERT INTO master_country (country_name) VALUES ('Mozambique');
      INSERT INTO master_country (country_name) VALUES ('Myanmar');
      INSERT INTO master_country (country_name) VALUES ('Namibia');
      INSERT INTO master_country (country_name) VALUES ('Nauru');
      INSERT INTO master_country (country_name) VALUES ('Nepal');
      INSERT INTO master_country (country_name) VALUES ('Netherlands');
      INSERT INTO master_country (country_name) VALUES ('New Caledonia');
      INSERT INTO master_country (country_name) VALUES ('New Zealand');
      INSERT INTO master_country (country_name) VALUES ('Nicaragua');
      INSERT INTO master_country (country_name) VALUES ('Niger');
      INSERT INTO master_country (country_name) VALUES ('Nigeria');
      INSERT INTO master_country (country_name) VALUES ('Niue');
      INSERT INTO master_country (country_name) VALUES ('Norfolk Island');
      INSERT INTO master_country (country_name) VALUES ('Northern Mariana Islands');
      INSERT INTO master_country (country_name) VALUES ('Norway');
      INSERT INTO master_country (country_name) VALUES ('Oman');
      INSERT INTO master_country (country_name) VALUES ('Pakistan');
      INSERT INTO master_country (country_name) VALUES ('Palau');
      INSERT INTO master_country (country_name) VALUES ('Panama');
      INSERT INTO master_country (country_name) VALUES ('Papua New Guinea');
      INSERT INTO master_country (country_name) VALUES ('Paraguay');
      INSERT INTO master_country (country_name) VALUES ('Peru');
      INSERT INTO master_country (country_name) VALUES ('Philippines');
      INSERT INTO master_country (country_name) VALUES ('Pitcairn');
      INSERT INTO master_country (country_name) VALUES ('Poland');
      INSERT INTO master_country (country_name) VALUES ('Portugal');
      INSERT INTO master_country (country_name) VALUES ('Puerto Rico');
      INSERT INTO master_country (country_name) VALUES ('Qatar');
      INSERT INTO master_country (country_name) VALUES ('Romania');
      INSERT INTO master_country (country_name) VALUES ('Russian Federation');
      INSERT INTO master_country (country_name) VALUES ('Rwanda');
      INSERT INTO master_country (country_name) VALUES ('Saint Kitts and Nevis');
      INSERT INTO master_country (country_name) VALUES ('Saint Lucia');
      INSERT INTO master_country (country_name) VALUES ('Saint Martin (French part)');
      INSERT INTO master_country (country_name) VALUES ('Saint Pierre and Miquelon');
      INSERT INTO master_country (country_name) VALUES ('Saint Vincent and the Grenadines');
      INSERT INTO master_country (country_name) VALUES ('Samoa');
      INSERT INTO master_country (country_name) VALUES ('San Marino');
      INSERT INTO master_country (country_name) VALUES ('Sao Tome and Principe');
      INSERT INTO master_country (country_name) VALUES ('Saudi Arabia');
      INSERT INTO master_country (country_name) VALUES ('Senegal');
      INSERT INTO master_country (country_name) VALUES ('Serbia');
      INSERT INTO master_country (country_name) VALUES ('Seychelles');
      INSERT INTO master_country (country_name) VALUES ('Sierra Leone');
      INSERT INTO master_country (country_name) VALUES ('Singapore');
      INSERT INTO master_country (country_name) VALUES ('Sint Maarten (Dutch part)');
      INSERT INTO master_country (country_name) VALUES ('Slovakia');
      INSERT INTO master_country (country_name) VALUES ('Slovenia');
      INSERT INTO master_country (country_name) VALUES ('Solomon Islands');
      INSERT INTO master_country (country_name) VALUES ('Somalia');
      INSERT INTO master_country (country_name) VALUES ('South Africa');
      INSERT INTO master_country (country_name) VALUES ('South Georgia and the South Sandwich Islands');
      INSERT INTO master_country (country_name) VALUES ('South Sudan');
      INSERT INTO master_country (country_name) VALUES ('Spain');
      INSERT INTO master_country (country_name) VALUES ('Sri Lanka');
      INSERT INTO master_country (country_name) VALUES ('State of Palestine');
      INSERT INTO master_country (country_name) VALUES ('Sudan');
      INSERT INTO master_country (country_name) VALUES ('Suriname');
      INSERT INTO master_country (country_name) VALUES ('Svalbard and Jan Mayen');
      INSERT INTO master_country (country_name) VALUES ('Swaziland');
      INSERT INTO master_country (country_name) VALUES ('Sweden');
      INSERT INTO master_country (country_name) VALUES ('Switzerland');
      INSERT INTO master_country (country_name) VALUES ('Syrian Arab Republic');
      INSERT INTO master_country (country_name) VALUES ('Tajikistan');
      INSERT INTO master_country (country_name) VALUES ('Thailand');
      INSERT INTO master_country (country_name) VALUES ('Timor-Leste');
      INSERT INTO master_country (country_name) VALUES ('Togo');
      INSERT INTO master_country (country_name) VALUES ('Tokelau');
      INSERT INTO master_country (country_name) VALUES ('Tonga');
      INSERT INTO master_country (country_name) VALUES ('Trinidad and Tobago');
      INSERT INTO master_country (country_name) VALUES ('Tunisia');
      INSERT INTO master_country (country_name) VALUES ('Turkey');
      INSERT INTO master_country (country_name) VALUES ('Turkmenistan');
      INSERT INTO master_country (country_name) VALUES ('Turks and Caicos Islands');
      INSERT INTO master_country (country_name) VALUES ('Tuvalu');
      INSERT INTO master_country (country_name) VALUES ('Uganda');
      INSERT INTO master_country (country_name) VALUES ('Ukraine');
      INSERT INTO master_country (country_name) VALUES ('United Arab Emirates');
      INSERT INTO master_country (country_name) VALUES ('United Kingdom');
      INSERT INTO master_country (country_name) VALUES ('United States');
      INSERT INTO master_country (country_name) VALUES ('United States Minor Outlying Islands');
      INSERT INTO master_country (country_name) VALUES ('Uruguay');
      INSERT INTO master_country (country_name) VALUES ('Uzbekistan');
      INSERT INTO master_country (country_name) VALUES ('Vanuatu');
      INSERT INTO master_country (country_name) VALUES ('Viet Nam');
      INSERT INTO master_country (country_name) VALUES ('Wallis and Futuna');
      INSERT INTO master_country (country_name) VALUES ('Western Sahara');
      INSERT INTO master_country (country_name) VALUES ('Yemen');
      INSERT INTO master_country (country_name) VALUES ('Zambia');
      INSERT INTO master_country (country_name) VALUES ('Zimbabwe');
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM master_country WHERE country_name IN (
        'Afghanistan', 'Albania', 'Algeria', 'American Samoa', 'Andorra', 'Angola', 'Anguilla', 
        'Antarctica', 'Antigua and Barbuda', 'Argentina', 'Armenia', 'Aruba', 'Australia', 
        'Austria', 'Azerbaijan', 'Bahamas', 'Bahrain', 'Bangladesh', 'Barbados', 'Belarus', 
        'Belgium', 'Belize', 'Benin', 'Bermuda', 'Bhutan', 'Bosnia and Herzegovina', 'Botswana', 
        'Bouvet Island', 'Brazil', 'British Indian Ocean Territory', 'Brunei Darussalam', 
        'Bulgaria', 'Burkina Faso', 'Burundi', 'Cambodia', 'Cameroon', 'Canada',
        'Cape Verde', 'Cayman Islands', 'Central African Republic', 'Chad', 'Chile', 'China', 
        'Christmas Island', 'Cocos (Keeling) Islands', 'Colombia', 'Comoros', 'Congo', 
        'Cook Islands', 'Costa Rica', 'Croatia', 'Cuba', 'Cyprus', 'Czech Republic', 
        'Denmark', 'Djibouti', 'Dominica', 'Dominican Republic', 'Ecuador', 'Egypt', 
        'El Salvador', 'Equatorial Guinea', 'Eritrea', 'Estonia', 'Ethiopia', 
        'Falkland Islands (Malvinas)', 'Faroe Islands', 'Fiji', 'Finland', 'France', 
        'French Guiana', 'French Polynesia', 'French Southern Territories', 'Gabon', 
        'Gambia', 'Georgia', 'Germany', 'Ghana', 'Gibraltar', 'Greece', 'Greenland', 
        'Grenada', 'Guadeloupe', 'Guam', 'Guatemala', 'Guernsey', 'Guinea', 'Guinea-Bissau', 
        'Guyana', 'Haiti', 'Heard Island and McDonald Islands', 'Holy See (Vatican City State)', 
        'Honduras', 'Hong Kong', 'Hungary', 'Iceland', 'India', 'Indonesia', 'Iran', 
        'Iraq', 'Ireland', 'Isle of Man', 'Israel', 'Italy', 'Jamaica', 'Japan', 'Jersey', 
        'Jordan', 'Kazakhstan', 'Kenya', 'Kiribati', 'Kuwait', 'Kyrgyzstan', 
        'Lao Peoples Democratic Republic', 'Latvia', 'Lebanon', 'Lesotho', 'Liberia', 
        'Libya', 'Liechtenstein', 'Lithuania', 'Luxembourg', 'Macao', 'Madagascar', 
        'Malawi', 'Malaysia', 'Maldives', 'Mali', 'Malta', 'Marshall Islands', 'Martinique', 
        'Mauritania', 'Mauritius', 'Mayotte', 'Mexico', 'Monaco', 'Mongolia', 'Montenegro', 
        'Montserrat', 'Morocco', 'Mozambique', 'Myanmar', 'Namibia', 'Nauru', 'Nepal', 
        'Netherlands', 'New Caledonia', 'New Zealand', 'Nicaragua', 'Niger', 'Nigeria', 
        'Niue', 'Norfolk Island', 'Northern Mariana Islands', 'Norway', 'Oman', 'Pakistan', 
        'Palau', 'Panama', 'Papua New Guinea', 'Paraguay', 'Peru', 'Philippines', 'Pitcairn', 
        'Poland', 'Portugal', 'Puerto Rico', 'Qatar', 'Romania', 'Russian Federation', 
        'Rwanda', 'Saint Kitts and Nevis', 'Saint Lucia', 'Saint Martin (French part)', 
        'Saint Pierre and Miquelon', 'Saint Vincent and the Grenadines', 'Samoa', 
        'San Marino', 'Sao Tome and Principe', 'Saudi Arabia', 'Senegal', 'Serbia', 
        'Seychelles', 'Sierra Leone', 'Singapore', 'Sint Maarten (Dutch part)', 'Slovakia', 
        'Slovenia', 'Solomon Islands', 'Somalia', 'South Africa', 'South Georgia and the South Sandwich Islands', 
        'South Sudan', 'Spain', 'Sri Lanka', 'State of Palestine', 'Sudan', 'Suriname', 
        'Svalbard and Jan Mayen', 'Swaziland', 'Sweden', 'Switzerland', 'Syrian Arab Republic', 
        'Tajikistan', 'Thailand', 'Timor-Leste', 'Togo', 'Tokelau', 'Tonga', 
        'Trinidad and Tobago', 'Tunisia', 'Turkey', 'Turkmenistan', 'Turks and Caicos Islands', 
        'Tuvalu', 'Uganda', 'Ukraine', 'United Arab Emirates', 'United Kingdom', 
        'United States', 'United States Minor Outlying Islands', 'Uruguay', 'Uzbekistan', 
        'Vanuatu', 'Viet Nam', 'Wallis and Futuna', 'Western Sahara', 'Yemen', 'Zambia', 
        'Zimbabwe');
    `);
  }
}
