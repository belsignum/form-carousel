#
# Add toggle for AJAX carousel rendering on EXT:form content elements
#
CREATE TABLE tt_content (
	tx_formcarousel_enable tinyint(1) unsigned NOT NULL DEFAULT '0',
	tx_formcarousel_indicators varchar(256) NOT NULL DEFAULT ''
);
