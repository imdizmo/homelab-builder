package utils

import (
	"fmt"
	"net"
	"strconv"
	"strings"
)

// SubnetPrefix returns the first three octets of an IPv4 address, e.g. "192.168.1".
func SubnetPrefix(ip string) string {
	parts := strings.Split(ip, ".")
	if len(parts) >= 3 {
		return strings.Join(parts[0:3], ".")
	}
	return "192.168.1"
}

// ParseLastOctet extracts the last octet of an IPv4 address as an integer.
func ParseLastOctet(ip string) int {
	parts := strings.Split(ip, ".")
	if len(parts) != 4 {
		return -1
	}
	val, err := strconv.Atoi(parts[3])
	if err != nil {
		return -1
	}
	return val
}

// FormatIP builds an IPv4 string from a /24 prefix and a last octet.
func FormatIP(prefix string, lastOctet int) string {
	return fmt.Sprintf("%s.%d", prefix, lastOctet)
}

// IsValidIPv4 checks whether a string is a valid IPv4 address.
func IsValidIPv4(ip string) bool {
	parsed := net.ParseIP(ip)
	return parsed != nil && parsed.To4() != nil
}

// IPsInSameSubnet checks whether two IPs share the same /24 prefix.
func IPsInSameSubnet(a, b string) bool {
	return SubnetPrefix(a) == SubnetPrefix(b)
}
